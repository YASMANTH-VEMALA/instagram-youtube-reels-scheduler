import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google-drive";

export const runtime = "nodejs";

function requestOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.redirect(buildGoogleAuthUrl(requestOrigin(request)));
  } catch (error) {
    const url = new URL("/", request.nextUrl.origin);
    url.searchParams.set(
      "drive_error",
      error instanceof Error ? error.message : "google_oauth_start_failed",
    );
    return NextResponse.redirect(url);
  }
}
