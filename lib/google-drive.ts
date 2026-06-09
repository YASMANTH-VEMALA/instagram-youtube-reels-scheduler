import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getCacheDir,
  getDriveConnection,
  saveDriveConnection,
  type DriveConnection,
} from "@/lib/upload-store";

const driveFolderMime = "application/vnd.google-apps.folder";
const driveApiBase = "https://www.googleapis.com/drive/v3";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  resourceKey?: string;
  folderPath: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type DriveListResponse = {
  files?: {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    webViewLink?: string;
    resourceKey?: string;
  }[];
  nextPageToken?: string;
  error?: {
    message?: string;
  };
};

function envValue(name: string) {
  return process.env[name]?.trim();
}

function googleRedirectUri(requestOrigin?: string) {
  if (envValue("GOOGLE_REDIRECT_URI")) return envValue("GOOGLE_REDIRECT_URI")!;
  const appUrl = envValue("NEXT_PUBLIC_APP_URL") || requestOrigin || "http://localhost:8000";
  return `${appUrl.replace(/\/$/, "")}/api/google/oauth/callback`;
}

export function buildGoogleAuthUrl(requestOrigin?: string) {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is missing");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri(requestOrigin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.readonly");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url;
}

export async function exchangeGoogleCode(code: string, requestOrigin?: string) {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth env values are missing");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(requestOrigin),
    }),
  });
  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token exchange failed");
  }

  await saveDriveConnection({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    connectedAt: new Date().toISOString(),
  });
}

async function refreshAccessToken(connection: DriveConnection) {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret || !connection.refreshToken) {
    throw new Error("Google Drive refresh token is missing. Reconnect Drive.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token refresh failed");
  }

  const nextConnection = {
    ...connection,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await saveDriveConnection(nextConnection);
  return nextConnection.accessToken;
}

export async function getGoogleAccessToken() {
  const connection = await getDriveConnection();
  if (!connection) throw new Error("Google Drive is not connected");

  if (connection.expiresAt && connection.expiresAt - Date.now() < 60_000) {
    return refreshAccessToken(connection);
  }

  return connection.accessToken;
}

export function extractDriveFolderId(input: string) {
  const value = input.trim();
  if (!value) return "";

  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];

  const idMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) return value;
  return "";
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function listFolderChildren(folderId: string, accessToken: string) {
  const children: DriveListResponse["files"] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${driveApiBase}/files`);
    url.searchParams.set("q", `'${escapeDriveQuery(folderId)}' in parents and trashed = false`);
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,resourceKey)",
    );
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = (await response.json()) as DriveListResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || "Could not list Google Drive folder");
    }

    children.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return children;
}

export async function scanDriveFolder(folderId: string) {
  const accessToken = await getGoogleAccessToken();
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const videos: DriveFile[] = [];
  const folders = [{ id: folderId, path: "" }];

  for (let index = 0; index < folders.length; index += 1) {
    const folder = folders[index];
    const children = (await listFolderChildren(folder.id, accessToken)).sort((a, b) =>
      collator.compare(a.name, b.name),
    );

    for (const child of children) {
      if (child.mimeType === driveFolderMime) {
        folders.push({
          id: child.id,
          path: folder.path ? `${folder.path} / ${child.name}` : child.name,
        });
        continue;
      }

      if (child.mimeType.startsWith("video/")) {
        videos.push({
          ...child,
          folderPath: folder.path || "Selected folder",
        });
      }
    }
  }

  return videos;
}

export async function downloadDriveFile(fileId: string, fileName: string) {
  const accessToken = await getGoogleAccessToken();
  const cacheDir = getCacheDir();
  await mkdir(cacheDir, { recursive: true });

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(cacheDir, `${fileId}-${safeName}`);
  const url = new URL(`${driveApiBase}/files/${fileId}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    let message = "Could not download Drive video";
    try {
      const data = (await response.json()) as { error?: { message?: string } };
      message = data.error?.message || message;
    } catch {
      // Keep the generic message for non-JSON errors.
    }
    throw new Error(message);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);
  return filePath;
}
