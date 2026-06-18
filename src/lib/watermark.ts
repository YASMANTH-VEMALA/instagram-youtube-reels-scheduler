import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import https from 'https';

const TMP_DIR = path.join(process.cwd(), 'tmp');

// Ensure tmp directory exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Download remote file helper
function downloadFile(url: string, destPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download watermark: Status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Margins map based on resolution
const POSITION_MAP_1080P: Record<string, string> = {
  'bottom-right': 'W-w-30:H-h-30',
  'bottom-left': '30:H-h-30',
  'top-right': 'W-w-30:30',
  'top-left': '30:30',
  'center': '(W-w)/2:(H-h)/2',
};

const POSITION_MAP_4K: Record<string, string> = {
  'bottom-right': 'W-w-60:H-h-60',
  'bottom-left': '60:H-h-60',
  'top-right': 'W-w-60:60',
  'top-left': '60:60',
  'center': '(W-w)/2:(H-h)/2',
};

/**
 * Processes and rescales video (default 1080p) using Lanczos filter and applies watermark if provided.
 */
export async function processAndUpscaleVideo(
  videoPath: string,
  watermarkUrl: string | null,
  position: string = 'bottom-right'
): Promise<string> {
  const uniqueId = Math.random().toString(36).substring(2, 15);
  let localWatermarkPath = '';
  
  try {
    // 1. Download watermark if remote URL
    if (watermarkUrl && watermarkUrl.startsWith('http')) {
      const ext = path.extname(new URL(watermarkUrl).pathname) || '.png';
      localWatermarkPath = path.join(TMP_DIR, `wm_${uniqueId}${ext}`);
      await downloadFile(watermarkUrl, localWatermarkPath);
    } else if (watermarkUrl) {
      localWatermarkPath = watermarkUrl;
    }

    // Determine target resolution from env
    const resolution = process.env.VIDEO_RESOLUTION || '1080p';
    const is4K = resolution.toLowerCase() === '4k';
    const width = is4K ? 2160 : 1080;
    const height = is4K ? 3840 : 1920;
    
    const outputPath = path.join(TMP_DIR, `processed_${resolution}_${uniqueId}.mp4`);
    const positionMap = is4K ? POSITION_MAP_4K : POSITION_MAP_1080P;
    const overlayCoords = positionMap[position] || positionMap['bottom-right'];

    let filterComplex = '';
    let cmdInputs = `-i "${videoPath}"`;

    if (localWatermarkPath && fs.existsSync(localWatermarkPath)) {
      cmdInputs += ` -i "${localWatermarkPath}"`;
      // Scale video (Lanczos), scale watermark to 18% of video width, and overlay
      filterComplex = `[0:v]scale=${width}:${height}:flags=lanczos[vid];[1:v]scale=w=${width}*0.18:h=-1[wm];[vid][wm]overlay=${overlayCoords}`;
    } else {
      // Scale video (Lanczos)
      filterComplex = `[0:v]scale=${width}:${height}:flags=lanczos`;
    }

    // CRF 23 provides excellent quality and is 5-6x smaller than CRF 17.
    // This allows videos to fit easily under Supabase's 50MB free tier upload limit.
    const crf = process.env.VIDEO_CRF || '23';
    const cmd = `ffmpeg -y ${cmdInputs} -filter_complex "${filterComplex}" -c:v libx264 -preset superfast -crf ${crf} -c:a aac -b:a 192k "${outputPath}"`;

    console.log(`[VideoProcessor] Running ${resolution} processing command: ${cmd}`);

    return new Promise<string>((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        // Clean up downloaded watermark file
        if (localWatermarkPath && localWatermarkPath.includes('wm_')) {
          fs.unlink(localWatermarkPath, () => {});
        }

        if (error) {
          console.error(`[VideoProcessor] ffmpeg ${resolution} processing failed:`, stderr);
          return reject(new Error(`${resolution} Video processing failed: ${error.message}. Stderr: ${stderr}`));
        }

        console.log(`[VideoProcessor] ffmpeg ${resolution} processing completed:`, outputPath);
        resolve(outputPath);
      });
    });
  } catch (err) {
    // Cleanup if anything fails
    if (localWatermarkPath && localWatermarkPath.includes('wm_') && fs.existsSync(localWatermarkPath)) {
      fs.unlinkSync(localWatermarkPath);
    }
    throw err;
  }
}

/**
 * Backward compatibility wrapper.
 */
export async function applyWatermark(
  videoPath: string,
  watermarkUrl: string,
  position: string = 'bottom-right'
): Promise<string> {
  return processAndUpscaleVideo(videoPath, watermarkUrl, position);
}
