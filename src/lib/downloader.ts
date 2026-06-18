import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

const TMP_DIR = path.join(process.cwd(), 'tmp');

// Ensure tmp directory exists
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

export interface DownloadResult {
  filePath: string;
  filename: string;
}

export function downloadReel(sourceUrl: string): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    // Basic validation of URL
    if (!sourceUrl.includes('instagram.com')) {
      return reject(new Error('Invalid URL. Must be an instagram.com URL.'));
    }

    const uniqueId = Math.random().toString(36).substring(2, 15);
    const filename = `reel_${uniqueId}.mp4`;
    const outputPath = path.join(TMP_DIR, filename);

    // Check if ffmpeg is available on the system
    const exec = require('child_process').execSync;
    let hasFfmpeg = false;
    try {
      exec('which ffmpeg');
      hasFfmpeg = true;
    } catch (_) {
      // ffmpeg not found
    }

    const format = hasFfmpeg 
      ? 'bestvideo+bestaudio/best' 
      : 'best[ext=mp4]/best';

    // Build arguments
    const args = [
      '--no-warnings',
      '--no-playlist',
      '-f', format,
    ];

    if (hasFfmpeg) {
      args.push('--merge-output-format', 'mp4');
    }

    args.push('-o', outputPath);

    // Optional cookies file
    const cookiesPath = process.env.YTDLP_COOKIES_PATH;
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }

    args.push(sourceUrl);

    const localYtdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');
    const ytdlpExecutable = fs.existsSync(localYtdlpPath) ? localYtdlpPath : 'yt-dlp';

    console.log(`Running yt-dlp with arguments: ${args.join(' ')}`);

    // Run yt-dlp binary
    execFile(ytdlpExecutable, args, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp download failed:', stderr);
        return reject(new Error(`Download failed: ${error.message}. Stderr: ${stderr}`));
      }

      console.log('yt-dlp completed successfully. File saved to:', outputPath);
      
      // Double check if file exists
      if (!fs.existsSync(outputPath)) {
        return reject(new Error(`yt-dlp succeeded but output file was not found at ${outputPath}`));
      }

      resolve({
        filePath: outputPath,
        filename,
      });
    });
  });
}
