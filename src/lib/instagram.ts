import { decrypt } from './crypto';

const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.instagram.com/${API_VERSION}`;

export interface ContainerStatus {
  status_code: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
  status: string;
  error?: string;
}

/**
 * Creates a Reels video container on Instagram Graph API.
 * Returns the creation ID.
 */
export async function createReelContainer(
  igUserId: string,
  encryptedAccessToken: string,
  videoUrl: string,
  caption: string
): Promise<string> {
  const token = decrypt(encryptedAccessToken);
  const url = `${BASE_URL}/${igUserId}/media`;

  console.log(`Creating Reel container for IG User: ${igUserId}, Video: ${videoUrl}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption,
      access_token: token,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    console.error(`Instagram createReelContainer failed: ${errorMsg}`);
    throw new Error(`Instagram API error (Container creation): ${errorMsg}`);
  }

  return data.id; // creation ID
}

/**
 * Checks the processing status of a Reels container.
 */
export async function getContainerStatus(
  creationId: string,
  encryptedAccessToken: string
): Promise<ContainerStatus> {
  const token = decrypt(encryptedAccessToken);
  const url = `${BASE_URL}/${creationId}?fields=status_code,status&access_token=${token}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    console.error(`Instagram getContainerStatus failed: ${errorMsg}`);
    throw new Error(`Instagram API error (Status check): ${errorMsg}`);
  }

  return {
    status_code: data.status_code,
    status: data.status,
    error: data.status_code === 'ERROR' ? (data.status || 'Container processing failed') : undefined,
  };
}

/**
 * Publishes the Reels container.
 * Returns the published media ID.
 */
export async function publishReel(
  igUserId: string,
  encryptedAccessToken: string,
  creationId: string
): Promise<string> {
  const token = decrypt(encryptedAccessToken);
  const url = `${BASE_URL}/${igUserId}/media_publish`;

  console.log(`Publishing Reel container: ${creationId} to user: ${igUserId}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: token,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    console.error(`Instagram publishReel failed: ${errorMsg}`);
    throw new Error(`Instagram API error (Publishing): ${errorMsg}`);
  }

  return data.id; // published media ID
}

/**
 * Fetches the permalink of a published Reel.
 */
export async function getReelPermalink(
  mediaId: string,
  encryptedAccessToken: string
): Promise<string> {
  const token = decrypt(encryptedAccessToken);
  const url = `${BASE_URL}/${mediaId}?fields=permalink&access_token=${token}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || JSON.stringify(data);
    console.error(`Instagram getReelPermalink failed: ${errorMsg}`);
    throw new Error(`Instagram API error (Permalink fetch): ${errorMsg}`);
  }

  return data.permalink; // published Reel URL (e.g. https://www.instagram.com/reel/...)
}

