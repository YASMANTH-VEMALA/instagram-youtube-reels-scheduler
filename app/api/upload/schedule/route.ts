import { NextRequest, NextResponse } from "next/server";
import {
  listUploadQueue,
  saveUploadQueue,
  publicQueueItem,
  type UploadQueueItem,
} from "@/lib/upload-store";

export const runtime = "nodejs";

function nextFourHourSlot(from = new Date()) {
  const next = new Date(from);
  next.setMinutes(0, 0, 0);
  const remainder = next.getHours() % 4;
  const hoursToAdd = remainder === 0 && next > from ? 0 : 4 - remainder;
  next.setHours(next.getHours() + (hoursToAdd || 4));
  return next;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    intervalHours?: number;
    targetAccountId?: string;
  };
  const intervalHours = Number(body.intervalHours || 4);
  const targetAccountId = String(body.targetAccountId || "all");
  const queue = await listUploadQueue();
  const schedulable = queue.filter(
    (item) => item.status !== "published" && item.status !== "skipped",
  );
  const start = nextFourHourSlot();
  const slotById = new Map<string, string>();

  schedulable.forEach((item, index) => {
    const scheduledAt = new Date(start);
    scheduledAt.setHours(start.getHours() + index * intervalHours);
    slotById.set(item.id, scheduledAt.toISOString());
  });

  const nextQueue: UploadQueueItem[] = queue.map((item) => {
    const scheduledAt = slotById.get(item.id);
    if (!scheduledAt) return item;
    return {
      ...item,
      status: "scheduled",
      scheduledAt,
      targetAccountId,
      updatedAt: new Date().toISOString(),
      error: undefined,
    };
  });

  await saveUploadQueue(nextQueue);

  return NextResponse.json({
    ok: true,
    scheduled: schedulable.length,
    firstScheduledAt: schedulable.length ? start.toISOString() : null,
    queue: nextQueue.map(publicQueueItem),
  });
}
