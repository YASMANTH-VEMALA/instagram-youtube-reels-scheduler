import { NextResponse } from "next/server";
import {
  getDriveConnection,
  getUploadSettings,
  listUploadQueue,
  publicQueueItem,
} from "@/lib/upload-store";

export const runtime = "nodejs";

export async function GET() {
  const [driveConnection, settings, queue] = await Promise.all([
    getDriveConnection(),
    getUploadSettings(),
    listUploadQueue(),
  ]);

  return NextResponse.json({
    driveConnected: Boolean(driveConnection),
    driveConnectedAt: driveConnection?.connectedAt,
    settings,
    queue: queue.map(publicQueueItem),
  });
}
