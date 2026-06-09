import { NextRequest, NextResponse } from "next/server";
import { upsertInstagramAccount } from "@/lib/instagram-store";

export const runtime = "nodejs";

type TokenResponse = {
  access_token?: string;
  user_id?: number | string;
  token_type?: string;
  expires_in?: number;
  error_message?: string;
  error?: {
    message?: string;
  };
};

type ProfileResponse = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  profile_picture_url?: string;
  error?: {
    message?: string;
  };
};

function requestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function appUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || requestOrigin(request);
}

function getRedirectUri(request: NextRequest) {
  const configuredRedirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim();

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  return `${appUrl(request).replace(/\/$/, "")}/api/instagram/oauth/callback`;
}

function redirectWithError(request: NextRequest, message: string) {
  const url = new URL("/", appUrl(request));
  url.searchParams.set("instagram_error", message);
  return NextResponse.redirect(url);
}

async function exchangeCodeForToken(code: string, redirectUri: string) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Instagram OAuth env values are missing");
  }

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await response.json()) as TokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_message || data.error?.message || "Token exchange failed");
  }

  return data;
}

async function exchangeForLongLivedToken(accessToken: string) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appSecret) {
    throw new Error("Instagram app secret is missing");
  }

  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const data = (await response.json()) as TokenResponse;

  if (!response.ok || !data.access_token) {
    return {
      access_token: accessToken,
      token_type: data.token_type,
      expires_in: data.expires_in,
    };
  }

  return data;
}

async function fetchProfile(accessToken: string) {
  const url = new URL("https://graph.instagram.com/me");
  url.searchParams.set(
    "fields",
    "id,user_id,username,account_type,profile_picture_url",
  );
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const data = (await response.json()) as ProfileResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || "Could not fetch Instagram profile");
  }

  return data;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError =
    request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return redirectWithError(request, oauthError);
  }

  if (!code) {
    return redirectWithError(request, "missing_code");
  }

  try {
    const shortToken = await exchangeCodeForToken(code, getRedirectUri(request));
    const longToken = await exchangeForLongLivedToken(shortToken.access_token!);
    const accessToken = longToken.access_token || shortToken.access_token!;
    const profile = await fetchProfile(accessToken);
    const userId = String(profile.user_id || profile.id || shortToken.user_id);

    await upsertInstagramAccount({
      id: String(profile.id || userId),
      userId,
      username: profile.username ? `@${profile.username.replace(/^@/, "")}` : userId,
      accountType: profile.account_type || "Instagram profile",
      profilePictureUrl: profile.profile_picture_url,
      accessToken,
      tokenType: longToken.token_type || shortToken.token_type,
      expiresIn: longToken.expires_in || shortToken.expires_in,
      connectedAt: new Date().toISOString(),
    });

    const url = new URL("/", appUrl(request));
    url.searchParams.set("instagram_connected", "1");
    return NextResponse.redirect(url);
  } catch (error) {
    return redirectWithError(
      request,
      error instanceof Error ? error.message : "instagram_login_failed",
    );
  }
}
