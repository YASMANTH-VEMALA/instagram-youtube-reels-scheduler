import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { downloadDriveFile } from "@/lib/google-drive";
import { getInstagramAccountsWithTokens } from "@/lib/instagram-store";
import {
  addPublishAttempt,
  listUploadQueue,
  updateQueueItem,
  type UploadQueueItem,
} from "@/lib/upload-store";

type MetaResponse = {
  id?: string;
  status_code?: string;
  permalink?: string;
  error?: {
    message?: string;
  };
};

function publicAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is required for Instagram video fetch");
  return url.replace(/\/$/, "");
}

async function ensureCachedVideo(item: UploadQueueItem) {
  if (item.cachePath) {
    try {
      await stat(item.cachePath);
      return item.cachePath;
    } catch {
      // Re-download if the cache file was removed.
    }
  }

  const cachePath = await downloadDriveFile(item.driveFileId, item.name);
  await updateQueueItem(item.id, (current) => ({ ...current, cachePath }));
  return cachePath;
}

async function createReelContainer(
  accountId: string,
  accessToken: string,
  item: UploadQueueItem,
) {
  const url = new URL(`https://graph.instagram.com/v21.0/${accountId}/media`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: accessToken,
      media_type: "REELS",
      video_url: `${publicAppUrl()}/api/upload/video/${item.publishToken}`,
      caption: item.caption,
      share_to_feed: "true",
    }),
  });
  const data = (await response.json()) as MetaResponse;

  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Instagram Reel container creation failed");
  }

  return data.id;
}

async function pollContainer(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const url = new URL(`https://graph.instagram.com/v21.0/${containerId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url);
    const data = (await response.json()) as MetaResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || "Could not check Instagram container status");
    }

    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Instagram container status: ${data.status_code}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }

  throw new Error("Instagram container did not finish processing in time");
}

async function publishContainer(
  accountId: string,
  accessToken: string,
  containerId: string,
) {
  const response = await fetch(
    `https://graph.instagram.com/v21.0/${accountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: accessToken,
        creation_id: containerId,
      }),
    },
  );
  const data = (await response.json()) as MetaResponse;

  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || "Instagram Reel publish failed");
  }

  return data.id;
}

async function fetchPermalink(mediaId: string, accessToken: string) {
  const url = new URL(`https://graph.instagram.com/v21.0/${mediaId}`);
  url.searchParams.set("fields", "permalink");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const data = (await response.json()) as MetaResponse;

  if (!response.ok) return undefined;
  return data.permalink;
}

export async function publishQueueItem(item: UploadQueueItem) {
  const attemptId = randomUUID();
  await addPublishAttempt({
    id: attemptId,
    itemId: item.id,
    startedAt: new Date().toISOString(),
    status: "started",
  });

  await updateQueueItem(item.id, (current) => ({
    ...current,
    status: "publishing",
    attempts: current.attempts + 1,
    error: undefined,
  }));

  try {
    const accounts = await getInstagramAccountsWithTokens(item.targetAccountId);
    const account = accounts.find((candidate) => candidate.userId === item.targetAccountId) || accounts[0];
    if (!account) throw new Error("No connected Instagram account with a publish token");

    await ensureCachedVideo(item);
    const queue = await listUploadQueue();
    const freshItem = queue.find((candidate) => candidate.id === item.id) || item;
    const containerId = await createReelContainer(account.userId, account.accessToken, freshItem);
    await updateQueueItem(item.id, (current) => ({
      ...current,
      instagramContainerId: containerId,
    }));
    await pollContainer(containerId, account.accessToken);
    const mediaId = await publishContainer(account.userId, account.accessToken, containerId);
    const permalink = await fetchPermalink(mediaId, account.accessToken);

    await updateQueueItem(item.id, (current) => ({
      ...current,
      status: "published",
      instagramMediaId: mediaId,
      permalink,
      error: undefined,
    }));
    await addPublishAttempt({
      id: attemptId,
      itemId: item.id,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: "success",
      message: permalink || mediaId,
    });

    return { ok: true, mediaId, permalink };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    await updateQueueItem(item.id, (current) => ({
      ...current,
      status: current.attempts >= 3 ? "failed" : "scheduled",
      error: message,
    }));
    await addPublishAttempt({
      id: attemptId,
      itemId: item.id,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: "failed",
      message,
    });

    return { ok: false, error: message };
  }
}
