import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google-drive";

export const runtime = "nodejs";

function requestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

function appUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || requestOrigin(request);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError =
    request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error");

  const redirectUrl = new URL("/", appUrl(request));

  if (oauthError || !code) {
    redirectUrl.searchParams.set("drive_error", oauthError || "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeGoogleCode(code, requestOrigin(request));
    redirectUrl.searchParams.set("drive_connected", "1");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set(
      "drive_error",
      error instanceof Error ? error.message : "google_login_failed",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
