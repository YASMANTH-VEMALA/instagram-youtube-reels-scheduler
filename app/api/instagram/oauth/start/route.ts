import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const defaultScopes = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
];

function getRequestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

function getRedirectUri(request: NextRequest) {
  const configuredRedirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim();

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || getRequestOrigin(request);
  return `${appUrl.replace(/\/$/, "")}/api/instagram/oauth/callback`;
}

export async function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID;

  if (!appId) {
    return NextResponse.redirect(
      new URL("/?instagram_error=missing_app_id", getRequestOrigin(request)),
    );
  }

  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", getRedirectUri(request));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    process.env.INSTAGRAM_OAUTH_SCOPES || defaultScopes.join(","),
  );
  authUrl.searchParams.set("enable_fb_login", "0");
  authUrl.searchParams.set("force_authentication", "1");

  return NextResponse.redirect(authUrl);
}
