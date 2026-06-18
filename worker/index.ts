import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { prisma } from '../src/lib/db';
import { downloadReel } from '../src/lib/downloader';
import { processAndUpscaleVideo } from '../src/lib/watermark';
import { createReelContainer, getContainerStatus, publishReel, getReelPermalink } from '../src/lib/instagram';
import { submitClipToMonsterLab } from '../src/lib/monsterlab';

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const POLL_INTERVAL_MS = 30000; // Poll every 30 seconds
const MAX_ATTEMPTS = 3;

// The public-facing URL (ngrok or production domain) — used to serve processed videos
const APP_URL = process.env.APP_URL || process.env.INSTAGRAM_REDIRECT_URI?.replace(/\/api\/instagram\/oauth\/callback$/, '') || '';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Write a log entry to the PostLog table for real-time streaming to the UI.
 */
async function log(postId: string, step: string, message: string, level: string = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = level === 'error' ? '✗' : level === 'success' ? '✓' : level === 'warn' ? '⚠' : '→';
  console.log(`[Worker] ${prefix} Post ${postId.slice(-6)}: [${step}] ${message}`);
  
  try {
    await prisma.postLog.create({
      data: { postId, step, message, level },
    });
  } catch (err) {
    console.error('[Worker] Failed to write log entry:', err);
  }
}

async function claimPost(): Promise<any> {
  // Atomically claim a queued post from the central queue using SKIP LOCKED.
  const query = `
    UPDATE "Post"
    SET "status" = 'downloading', "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id"
      FROM "Post"
      WHERE "status" = 'queued' AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
      ORDER BY "scheduledAt" ASC, "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;

  const results = await prisma.$queryRawUnsafe<any[]>(query);
  return results && results.length > 0 ? results[0] : null;
}

async function processPost(post: any) {
  const videoPathsToCleanup: string[] = [];
  let uploadedToSupabase = false;
  const startTime = Date.now();

  await log(post.id, 'start', `Starting pipeline for source: ${post.sourceUrl}`, 'info');

  try {
    // 1. Fetch channel details
    const channel = await prisma.channel.findUnique({
      where: { id: post.channelId },
    });

    if (!channel) {
      throw new Error(`Channel associated with post not found: ${post.channelId}`);
    }

    await log(post.id, 'start', `Target channel: ${channel.name} (IG: ${channel.igUserId})`, 'info');

    // 2. Download the video
    await log(post.id, 'downloading', 'Downloading reel from Instagram via yt-dlp...', 'info');
    const dlStart = Date.now();
    const downloadResult = await downloadReel(post.sourceUrl);
    videoPathsToCleanup.push(downloadResult.filePath);
    let currentVideoPath = downloadResult.filePath;

    const dlSize = fs.statSync(currentVideoPath).size;
    const dlTimeSec = ((Date.now() - dlStart) / 1000).toFixed(1);
    await log(post.id, 'downloading', `Download complete — ${(dlSize / 1024 / 1024).toFixed(1)} MB in ${dlTimeSec}s`, 'success');

    // 3. Process and Upscale Video to 4K (and apply watermark if enabled)
    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'processing' },
    });

    const hasWatermark = post.watermark && channel.watermarkUrl;
    await log(post.id, 'processing', `Upscaling to 4K (2160×3840) with Lanczos filter${hasWatermark ? ' + watermark overlay' : ''}...`, 'info');
    await log(post.id, 'processing', 'This may take 1-3 minutes depending on video length...', 'info');
    
    const procStart = Date.now();
    const processedPath = await processAndUpscaleVideo(
      currentVideoPath,
      post.watermark ? channel.watermarkUrl : null,
      channel.watermarkPosition
    );
    videoPathsToCleanup.push(processedPath);
    currentVideoPath = processedPath;

    const procSize = fs.statSync(currentVideoPath).size;
    const procTimeSec = ((Date.now() - procStart) / 1000).toFixed(1);
    await log(post.id, 'processing', `4K processing complete — ${(procSize / 1024 / 1024).toFixed(1)} MB in ${procTimeSec}s`, 'success');

    // 4. Build public video URL (upload to Supabase if configured to save ngrok bandwidth)
    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'uploading' },
    });

    const processedFilename = path.basename(currentVideoPath);
    let publicVideoUrl: string;

    const canUseSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    const preferSupabase = process.env.PREFER_SUPABASE_STORAGE !== 'false';

    if (canUseSupabase && preferSupabase) {
      await log(post.id, 'uploading', 'Uploading processed video to Supabase Storage...', 'info');
      try {
        const { uploadVideo } = await import('../src/lib/supabase');
        publicVideoUrl = await uploadVideo(currentVideoPath, processedFilename);
        uploadedToSupabase = true;
        await log(post.id, 'uploading', `Uploaded to Supabase Storage: ${publicVideoUrl}`, 'success');
      } catch (err: any) {
        await log(post.id, 'uploading', `Supabase upload failed: ${err.message}. Falling back to local serving...`, 'warn');
        if (APP_URL) {
          publicVideoUrl = `${APP_URL}/api/videos/${processedFilename}`;
          await log(post.id, 'uploading', `Serving video locally via: ${publicVideoUrl}`, 'info');
        } else {
          throw err;
        }
      }
    } else if (APP_URL) {
      // Serve from local Next.js API route via ngrok/public URL
      publicVideoUrl = `${APP_URL}/api/videos/${processedFilename}`;
      await log(post.id, 'uploading', `Serving video locally via: ${publicVideoUrl}`, 'info');
      await log(post.id, 'uploading', 'Skipping Supabase upload — serving directly from local server.', 'success');
    } else {
      throw new Error('Neither Supabase Storage nor APP_URL is configured for serving the video.');
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { processedVideoUrl: publicVideoUrl },
    });

    // 5. Create Reel Container on Instagram Graph API
    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'publishing' },
    });

    await log(post.id, 'publishing', 'Creating Reel container on Instagram Graph API...', 'info');
    const creationId = await createReelContainer(
      channel.igUserId,
      channel.accessToken,
      publicVideoUrl,
      post.caption
    );

    await prisma.post.update({
      where: { id: post.id },
      data: { igCreationId: creationId },
    });

    await log(post.id, 'publishing', `Container created (ID: ${creationId}). Waiting for Instagram to process...`, 'info');

    // 6. Poll Container Status until finished (timeout ~ 5 mins)
    let statusFinished = false;
    const maxPolls = 60; // 5 minutes (60 * 5s)
    let pollCount = 0;

    while (!statusFinished && pollCount < maxPolls) {
      await sleep(5000);
      pollCount++;
      
      const statusData = await getContainerStatus(creationId, channel.accessToken);

      if (pollCount % 6 === 0 || statusData.status_code !== 'IN_PROGRESS') {
        await log(post.id, 'publishing', `Instagram processing: ${statusData.status_code} (poll ${pollCount}/${maxPolls})`, 'info');
      }

      if (statusData.status_code === 'FINISHED') {
        statusFinished = true;
        await log(post.id, 'publishing', 'Instagram finished processing the video!', 'success');
      } else if (statusData.status_code === 'ERROR') {
        throw new Error(`Instagram container processing failed: ${statusData.error || statusData.status}`);
      } else if (statusData.status_code === 'EXPIRED') {
        throw new Error('Instagram container expired.');
      }
    }

    if (!statusFinished) {
      throw new Error('Timeout waiting for Instagram to process the video (exceeded 5 minutes).');
    }

    // 7. Publish the Reel container
    await log(post.id, 'publishing', 'Publishing Reel to your Instagram account...', 'info');
    const mediaId = await publishReel(channel.igUserId, channel.accessToken, creationId);

    // 7.5 Retrieve Reel permalink and submit to MonsterLab
    let permalink = '';
    try {
      await log(post.id, 'publishing', 'Fetching published Reel permalink...', 'info');
      permalink = await getReelPermalink(mediaId, channel.accessToken);
    } catch (permErr: any) {
      await log(post.id, 'publishing', `Failed to fetch Reel permalink: ${permErr.message}`, 'warn');
    }

    let monsterlabClipId: string | undefined = undefined;
    let monsterlabStatus: string | undefined = undefined;

    if (permalink && process.env.MONSTERLAB_API_KEY && channel.monsterlabCampaignId) {
      await log(post.id, 'monsterlab', `Submitting to MonsterLab (Campaign: ${channel.monsterlabCampaignId})...`, 'info');
      try {
        const mlRes = await submitClipToMonsterLab(
          process.env.MONSTERLAB_API_KEY,
          channel.monsterlabCampaignId,
          permalink
        );
        monsterlabClipId = mlRes.id || mlRes.clipId;
        monsterlabStatus = mlRes.status || 'active';
        await log(post.id, 'monsterlab', `Successfully submitted to MonsterLab! Clip ID: ${monsterlabClipId}`, 'success');
      } catch (mlErr: any) {
        await log(post.id, 'monsterlab', `MonsterLab submission failed: ${mlErr.message}`, 'warn');
      }
    }

    // 8. Update DB to published
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: 'published',
        igMediaId: mediaId,
        publishedAt: new Date(),
        monsterlabClipId,
        monsterlabStatus,
      },
    });

    const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(0);
    await log(post.id, 'published', `Reel published successfully! Media ID: ${mediaId} — Total time: ${totalTimeSec}s`, 'success');

  } catch (error: any) {
    const errorMsg = error.message || String(error);
    await log(post.id, 'failed', `Error: ${errorMsg}`, 'error');

    // Exponential backoff or fail permanently
    if (post.attempts < MAX_ATTEMPTS) {
      const backoffMinutes = Math.pow(2, post.attempts); // 2 min, 4 min
      const nextScheduledAt = new Date(Date.now() + 1000 * 60 * backoffMinutes);
      
      await log(post.id, 'failed', `Will retry in ${backoffMinutes} minute(s) (attempt ${post.attempts}/${MAX_ATTEMPTS})`, 'warn');
      
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'queued',
          scheduledAt: nextScheduledAt,
          error: `Attempt ${post.attempts} failed: ${errorMsg}`,
        },
      });
    } else {
      await log(post.id, 'failed', `Permanently failed after ${MAX_ATTEMPTS} attempts.`, 'error');
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'failed',
          error: errorMsg,
        },
      });
    }
  } finally {
    // 9. Clean up all local temporary video files
    // Note: Don't delete the processed file if serving locally — Instagram needs time to fetch it.
    // We keep processed files but clean up raw downloads.
    for (const filePath of videoPathsToCleanup) {
      try {
        // Keep processed files (served via /api/videos/) for at least 1 hour ONLY if not uploaded to Supabase
        const isProcessed = path.basename(filePath).startsWith('processed_');
        if (isProcessed && !uploadedToSupabase && APP_URL) {
          await log(post.id, 'cleanup', `Keeping processed file for Instagram fetch: ${path.basename(filePath)}`, 'info');
          // Schedule cleanup after 1 hour
          setTimeout(() => {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[Worker] Delayed cleanup: deleted ${filePath}`);
              }
            } catch (e) {
              console.error(`[Worker] Delayed cleanup failed for ${filePath}:`, e);
            }
          }, 3600000); // 1 hour
          continue;
        }
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          await log(post.id, 'cleanup', `Cleaned up temp file: ${path.basename(filePath)}`, 'info');
        }
      } catch (e) {
        console.error(`[Worker] Failed to delete temp file ${filePath}:`, e);
      }
    }
  }
}

async function runWorker() {
  console.log('[Worker] ═══════════════════════════════════════');
  console.log('[Worker] Background worker started');
  console.log(`[Worker] Polling interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[Worker] APP_URL: ${APP_URL || '(not set — will use Supabase fallback)'}`);
  console.log(`[Worker] Max attempts: ${MAX_ATTEMPTS}`);
  console.log('[Worker] ═══════════════════════════════════════');
  
  while (true) {
    try {
      const post = await claimPost();
      if (post) {
        await processPost(post);
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error('[Worker] Unexpected error in worker loop:', error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

runWorker();
