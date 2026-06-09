import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const queuePath = path.join(process.cwd(), "cloud-upload-queue.json");
const graphBase = "https://graph.instagram.com/v21.0";
const driveBase = "https://www.googleapis.com/drive/v3";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

async function refreshGoogleToken(connection) {
  if (connection.expiresAt && connection.expiresAt - Date.now() > 60_000) {
    return connection.accessToken;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token refresh failed");
  }
  return data.access_token;
}

async function downloadDriveFile(fileId, fileName, accessToken) {
  const url = new URL(`${driveBase}/files/${fileId}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    let message = "Could not download Drive file";
    try {
      const data = await response.json();
      message = data.error?.message || message;
    } catch {}
    throw new Error(message);
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || contentType(fileName),
  };
}

function contentType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

async function ensureSupabaseBucket(bucket) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (response.ok) return;

  const createResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: bucket, name: bucket, public: false }),
  });
  if (!createResponse.ok && createResponse.status !== 409) {
    const data = await createResponse.json().catch(() => ({}));
    throw new Error(data.message || "Could not create Supabase Storage bucket");
  }
}

async function uploadToSupabase(bucket, objectPath, bytes, type) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": type,
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Could not upload video to Supabase Storage");
  }
}

async function signedSupabaseUrl(bucket, objectPath) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.signedURL) {
    throw new Error(data.message || "Could not create Supabase signed URL");
  }
  return `${supabaseUrl}/storage/v1${data.signedURL}`;
}

async function removeSupabaseObject(bucket, objectPath) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [objectPath] }),
  });
}

async function createReelContainer(account, item, videoUrl) {
  const response = await fetch(`${graphBase}/${account.userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: account.accessToken,
      media_type: "REELS",
      video_url: videoUrl,
      caption: item.caption,
      share_to_feed: "true",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Instagram container creation failed");
  }
  return data.id;
}

async function pollContainer(account, containerId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const url = new URL(`${graphBase}/${containerId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", account.accessToken);
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message || "Could not check Instagram container");
    }
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Instagram container status: ${data.status_code}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("Instagram container did not finish in time");
}

async function publishContainer(account, containerId) {
  const response = await fetch(`${graphBase}/${account.userId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: account.accessToken,
      creation_id: containerId,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Instagram publish failed");
  }
  return data.id;
}

async function fetchPermalink(account, mediaId) {
  const url = new URL(`${graphBase}/${mediaId}`);
  url.searchParams.set("fields", "permalink");
  url.searchParams.set("access_token", account.accessToken);
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  return response.ok ? data.permalink : undefined;
}

async function main() {
  const queue = await readJson(queuePath);
  const now = Date.now();
  const item = queue
    .filter((entry) => entry.status === "scheduled" && entry.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .find((entry) => new Date(entry.scheduledAt).getTime() <= now);

  if (!item) {
    console.log("No due Instagram uploads.");
    return;
  }

  const driveConnection = JSON.parse(requiredEnv("GOOGLE_DRIVE_CONNECTION_JSON"));
  const accounts = JSON.parse(requiredEnv("INSTAGRAM_ACCOUNTS_JSON"));
  const account = accounts.find((candidate) => candidate.userId === item.targetAccountId);
  if (!account) throw new Error(`Instagram account not found for ${item.targetAccountId}`);

  item.status = "publishing";
  item.attempts = (item.attempts || 0) + 1;
  item.updatedAt = new Date().toISOString();
  await writeJson(queuePath, queue);

  const bucket = process.env.SUPABASE_BUCKET || "instagram-reels";
  const objectPath = `scheduled/${item.id}-${safeName(item.name)}`;

  try {
    await ensureSupabaseBucket(bucket);
    const googleToken = await refreshGoogleToken(driveConnection);
    const video = await downloadDriveFile(item.driveFileId, item.name, googleToken);
    await uploadToSupabase(bucket, objectPath, video.bytes, video.contentType);
    const videoUrl = await signedSupabaseUrl(bucket, objectPath);
    const containerId = await createReelContainer(account, item, videoUrl);
    item.instagramContainerId = containerId;
    item.updatedAt = new Date().toISOString();
    await writeJson(queuePath, queue);

    await pollContainer(account, containerId);
    const mediaId = await publishContainer(account, containerId);
    const permalink = await fetchPermalink(account, mediaId);

    item.status = "published";
    item.instagramMediaId = mediaId;
    item.permalink = permalink;
    item.error = undefined;
    item.updatedAt = new Date().toISOString();
    console.log(`Published ${item.name} to ${account.username}: ${permalink || mediaId}`);
  } catch (error) {
    item.status = item.attempts >= 3 ? "failed" : "scheduled";
    item.error = error instanceof Error ? error.message : "Publish failed";
    item.updatedAt = new Date().toISOString();
    console.error(`Publish failed for ${item.name}: ${item.error}`);
  } finally {
    await removeSupabaseObject(bucket, objectPath).catch(() => {});
    await writeJson(queuePath, queue);
  }
}

await main();
