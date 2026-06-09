import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { findQueueItemByToken } from "@/lib/upload-store";

export const runtime = "nodejs";

function contentType(fileName: string) {
  if (fileName.toLowerCase().endsWith(".mov")) return "video/quicktime";
  if (fileName.toLowerCase().endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const item = await findQueueItemByToken(token);

  if (!item?.cachePath) {
    return NextResponse.json({ error: "Video is not cached yet" }, { status: 404 });
  }

  try {
    const fileStat = await stat(item.cachePath);
    const stream = Readable.toWeb(createReadStream(item.cachePath));

    return new Response(stream as ReadableStream, {
      headers: {
        "Content-Type": contentType(item.name),
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Cached video not found" }, { status: 404 });
  }
}
