import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Polyfill WebSocket for Node.js environments (like background worker)
if (typeof global !== 'undefined' && typeof (global as any).WebSocket === 'undefined') {
  (global as any).WebSocket = require('ws');
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'clips';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Supabase env vars are missing. Storage features might not work.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

/**
 * Ensures the specified storage bucket exists, and creates it as public if missing.
 */
async function ensureBucketExists(bucketName: string) {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.warn('[Supabase] Failed to list buckets:', listError.message);
      return;
    }

    const exists = buckets.some((b) => b.name === bucketName);
    if (!exists) {
      console.log(`[Supabase] Bucket "${bucketName}" not found. Auto-creating public bucket...`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
      });
      if (createError) {
        console.error(`[Supabase] Failed to create bucket "${bucketName}":`, createError.message);
      } else {
        console.log(`[Supabase] Bucket "${bucketName}" created successfully.`);
      }
    }
  } catch (err) {
    console.error('[Supabase] Error checking/creating bucket:', err);
  }
}

export async function uploadVideo(filePath: string, filename: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for upload: ${filePath}`);
  }

  await ensureBucketExists(BUCKET_NAME);

  const fileStream = fs.readFileSync(filePath);
  const uploadPath = `processed/${filename}`;

  console.log(`Uploading video to Supabase Storage: ${BUCKET_NAME}/${uploadPath}`);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(uploadPath, fileStream, {
      contentType: 'video/mp4',
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload video to Supabase: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadPath);
  console.log(`Uploaded video. Public URL: ${data.publicUrl}`);
  return data.publicUrl;
}

export async function uploadWatermark(
  fileBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  await ensureBucketExists(BUCKET_NAME);

  const uniqueId = Math.random().toString(36).substring(2, 15);
  const ext = path.extname(filename) || '.png';
  const uploadPath = `watermarks/wm_${uniqueId}${ext}`;

  console.log(`Uploading watermark to Supabase Storage: ${BUCKET_NAME}/${uploadPath}`);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(uploadPath, fileBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload watermark to Supabase: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(uploadPath);
  console.log(`Uploaded watermark. Public URL: ${data.publicUrl}`);
  return data.publicUrl;
}
