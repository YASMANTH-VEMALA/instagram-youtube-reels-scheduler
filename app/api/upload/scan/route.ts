import { NextRequest, NextResponse } from "next/server";
import { templateCaption } from "@/lib/captions";
import { extractDriveFolderId, scanDriveFolder } from "@/lib/google-drive";
import {
  saveUploadSettings,
  upsertQueueItems,
  publicQueueItem,
  type UploadSettings,
} from "@/lib/upload-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<UploadSettings>;
    const folderUrl = String(body.folderUrl || "").trim();
    const folderId = body.folderId || extractDriveFolderId(folderUrl);

    if (!folderId) {
      return NextResponse.json(
        { error: "Paste a valid Google Drive folder URL first." },
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

    const files = await scanDriveFolder(folderId);
    const queueCandidates = files.map((file) => ({
      driveFileId: file.id,
      driveResourceKey: file.resourceKey,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      folderPath: file.folderPath,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      targetAccountId: settings.targetAccountId,
      caption: templateCaption({
        fileName: file.name,
        folderPath: file.folderPath,
        captionTemplate: settings.captionTemplate,
        trendMode: settings.trendMode,
        trendNiche: settings.trendNiche,
        hookStyle: settings.hookStyle,
        hashtagPack: settings.hashtagPack,
      }),
    }));
    const result = await upsertQueueItems(queueCandidates);

    return NextResponse.json({
      ok: true,
      found: files.length,
      added: result.added.length,
      queue: result.queue.map(publicQueueItem),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not scan Google Drive folder",
      },
      { status: 500 },
    );
  }
}
