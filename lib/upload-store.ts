import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type DriveConnection = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
  connectedAt: string;
};

export type UploadSettings = {
  folderUrl: string;
  folderId: string;
  targetAccountId: string;
  captionTemplate: string;
  autoUpload: boolean;
  intervalHours: number;
  trendMode: boolean;
  trendNiche: string;
  hookStyle: string;
  hashtagPack: string;
  updatedAt: string;
};

export type UploadQueueStatus =
  | "queued"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "skipped";

export type UploadQueueItem = {
  id: string;
  driveFileId: string;
  driveResourceKey?: string;
  name: string;
  mimeType: string;
  size?: string;
  folderPath: string;
  modifiedTime?: string;
  webViewLink?: string;
  caption: string;
  status: UploadQueueStatus;
  targetAccountId?: string;
  scheduledAt?: string;
  detectedAt: string;
  updatedAt: string;
  attempts: number;
  publishToken: string;
  cachePath?: string;
  instagramContainerId?: string;
  instagramMediaId?: string;
  permalink?: string;
  error?: string;
};

export type PublishAttempt = {
  id: string;
  itemId: string;
  startedAt: string;
  finishedAt?: string;
  status: "started" | "success" | "failed";
  message?: string;
};

const storeDir = path.join(process.cwd(), ".data");
const driveConnectionPath = path.join(storeDir, "google-drive-connection.json");
const uploadSettingsPath = path.join(storeDir, "drive-upload-settings.json");
const queuePath = path.join(storeDir, "drive-upload-queue.json");
const attemptsPath = path.join(storeDir, "drive-upload-attempts.json");

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

export async function getDriveConnection() {
  return readJson<DriveConnection | null>(driveConnectionPath, null);
}

export async function saveDriveConnection(connection: DriveConnection) {
  await writeJson(driveConnectionPath, connection);
}

export async function getUploadSettings() {
  return readJson<UploadSettings | null>(uploadSettingsPath, null);
}

export async function saveUploadSettings(settings: UploadSettings) {
  await writeJson(uploadSettingsPath, settings);
}

export async function listUploadQueue() {
  return readJson<UploadQueueItem[]>(queuePath, []);
}

export async function saveUploadQueue(items: UploadQueueItem[]) {
  await writeJson(queuePath, items);
}

export async function upsertQueueItems(incoming: Omit<UploadQueueItem, "id" | "detectedAt" | "updatedAt" | "attempts" | "publishToken" | "status">[]) {
  const existing = await listUploadQueue();
  const existingIds = new Set(existing.map((item) => item.driveFileId));
  const now = new Date().toISOString();
  const nextItems: UploadQueueItem[] = incoming
    .filter((item) => !existingIds.has(item.driveFileId))
    .map((item) => ({
      ...item,
      id: randomUUID(),
      status: "queued",
      detectedAt: now,
      updatedAt: now,
      attempts: 0,
      publishToken: randomUUID(),
    }));

  if (nextItems.length) {
    await saveUploadQueue([...existing, ...nextItems]);
  }

  return { added: nextItems, queue: [...existing, ...nextItems] };
}

export async function updateQueueItem(
  id: string,
  updater: (item: UploadQueueItem) => UploadQueueItem,
) {
  const items = await listUploadQueue();
  let updated: UploadQueueItem | null = null;
  const nextItems = items.map((item) => {
    if (item.id !== id) return item;
    updated = { ...updater(item), updatedAt: new Date().toISOString() };
    return updated;
  });

  await saveUploadQueue(nextItems);
  return updated;
}

export async function findQueueItemByToken(token: string) {
  const items = await listUploadQueue();
  return items.find((item) => item.publishToken === token) || null;
}

export async function findDueQueueItems(now = new Date()) {
  const items = await listUploadQueue();
  return items
    .filter(
      (item) =>
        item.status === "scheduled" &&
        item.scheduledAt &&
        new Date(item.scheduledAt).getTime() <= now.getTime(),
    )
    .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
}

export async function addPublishAttempt(attempt: PublishAttempt) {
  const attempts = await readJson<PublishAttempt[]>(attemptsPath, []);
  await writeJson(attemptsPath, [attempt, ...attempts].slice(0, 500));
}

export function getCacheDir() {
  return path.join(storeDir, "drive-cache");
}

export function publicQueueItem(item: UploadQueueItem) {
  const { publishToken, cachePath, ...safeItem } = item;
  void publishToken;
  void cachePath;
  return safeItem;
}
