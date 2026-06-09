import { NextRequest, NextResponse } from "next/server";
import { publishQueueItem } from "@/lib/instagram-publisher";
import {
  listUploadQueue,
  updateQueueItem,
  publicQueueItem,
} from "@/lib/upload-store";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "skip" | "publish" | "retry";
  };

  if (body.action === "skip") {
    const item = await updateQueueItem(id, (current) => ({
      ...current,
      status: "skipped",
    }));
    return NextResponse.json({ ok: Boolean(item), item: item ? publicQueueItem(item) : null });
  }

  if (body.action === "retry") {
    const item = await updateQueueItem(id, (current) => ({
      ...current,
      status: "scheduled",
      attempts: 0,
      error: undefined,
      scheduledAt: new Date().toISOString(),
    }));
    return NextResponse.json({ ok: Boolean(item), item: item ? publicQueueItem(item) : null });
  }

  if (body.action === "publish") {
    const queue = await listUploadQueue();
    const item = queue.find((candidate) => candidate.id === id);
    if (!item) return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    const result = await publishQueueItem(item);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
