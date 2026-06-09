import { NextRequest, NextResponse } from "next/server";
import { extractDriveFolderId } from "@/lib/google-drive";
import { saveUploadSettings, type UploadSettings } from "@/lib/upload-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<UploadSettings>;
  const folderUrl = String(body.folderUrl || "").trim();
  const folderId = body.folderId || extractDriveFolderId(folderUrl);

  if (!folderId) {
    return NextResponse.json(
      { error: "Drive folder URL or ID is required" },
      { status: 400 },
    );
  }

  const settings: UploadSettings = {
    folderUrl,
    folderId,
    targetAccountId: String(body.targetAccountId || "all"),
    captionTemplate: String(
      body.captionTemplate ||
        "Stop scrolling. This exercise targets {title} in under 30 seconds.\n\nSave this for your next workout.",
    ),
    autoUpload: Boolean(body.autoUpload ?? true),
    intervalHours: Number(body.intervalHours || 4),
    trendMode: Boolean(body.trendMode ?? true),
    trendNiche: String(body.trendNiche || "Fitness / exercise"),
    hookStyle: String(body.hookStyle || "Problem -> quick fix"),
    hashtagPack: String(
      body.hashtagPack ||
        "#fitness #workout #gymtips #exercise #homeworkout #reelsindia",
    ),
    updatedAt: new Date().toISOString(),
  };

  await saveUploadSettings(settings);
  return NextResponse.json({ ok: true, settings });
}
