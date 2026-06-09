import { NextRequest, NextResponse } from "next/server";
import { publishQueueItem } from "@/lib/instagram-publisher";
import { findDueQueueItems } from "@/lib/upload-store";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.UPLOAD_WORKER_SECRET?.trim();
  if (!secret) return true;
  return request.headers.get("x-upload-worker-secret") === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dueItems = await findDueQueueItems();
  const item = dueItems[0];

  if (!item) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const result = await publishQueueItem(item);
  return NextResponse.json({
    ok: result.ok,
    processed: 1,
    itemId: item.id,
    result,
  });
}
