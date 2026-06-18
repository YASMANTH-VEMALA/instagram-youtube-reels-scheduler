import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface ReelInfo {
  thumbnail: string | null;
  previewVideoUrl: string | null;
  caption: string | null;
  author: string | null;
  durationSec: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  postedAt: string | null; // ISO Date string
}

// In-memory cache to avoid repeated requests to Instagram (cache for 5 minutes)
interface CacheEntry {
  data: ReelInfo;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function fetchReelInfo(url: string): Promise<ReelInfo> {
  return new Promise((resolve, reject) => {
    // 1. Check URL formatting
    if (!url.includes('instagram.com')) {
      return reject(new Error('Invalid URL. Must be an instagram.com URL.'));
    }

    // Clean URL to use as cache key (remove query parameters except maybe some basic ones if needed)
    let cleanUrl = url;
    try {
      const parsedUrl = new URL(url);
      cleanUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch (_) {
      // fallback
    }

    // 2. Check Cache
    const cached = cache.get(cleanUrl);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[ReelInfo] Cache hit for ${cleanUrl}`);
      return resolve(cached.data);
    }

    // 3. Build arguments
    const args = [
      '-J',
      '-f', 'best',
      '--no-warnings',
      '--no-playlist',
      '--extractor-retries', '3',
      '--add-header', 'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
    ];

    const cookiesPath = process.env.YTDLP_COOKIES_PATH;
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      args.push('--cookies', cookiesPath);
    }

    args.push(url);

    console.log(`[ReelInfo] Running yt-dlp metadata fetch for: ${cleanUrl}`);

    const localYtdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');
    const ytdlpExecutable = fs.existsSync(localYtdlpPath) ? localYtdlpPath : 'yt-dlp';

    // Run yt-dlp with a 30s timeout
    execFile(
      ytdlpExecutable,
      args,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          if ((error as any).signal === 'SIGTERM' || (error as any).signal === 'SIGKILL') {
            return reject(new Error('Fetching reel metadata timed out after 30 seconds.'));
          }
          // Surface the actual yt-dlp error for easier debugging
          const errDetail = (stderr || error.message || '').split('\n').find((l: string) => l.includes('ERROR:') || l.includes('error')) || stderr || error.message;
          console.error('[ReelInfo] yt-dlp error:', errDetail);
          // Distinguish login-required vs genuinely unavailable
          if (errDetail.includes('login') || errDetail.includes('Login') || errDetail.includes('cookies')) {
            return reject(new Error('Instagram requires login to fetch this reel. Please set YTDLP_COOKIES_PATH in your .env file.'));
          }
          return reject(new Error('Failed to retrieve reel metadata. It may be private or unavailable.'));
        }

        try {
          const json = JSON.parse(stdout);
          
          // Find the best preview video url (direct media url with sound)
          let previewVideoUrl: string | null = json.url || null;
          
          if (!previewVideoUrl && json.formats && Array.isArray(json.formats)) {
            // Filter formats that have BOTH video and audio streams
            const combinedFormats = json.formats.filter(
              (f: any) => f.url && f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none'
            );
            
            if (combinedFormats.length > 0) {
              const bestFormat = combinedFormats.reduce((best: any, current: any) => {
                const bestHeight = best.height || 0;
                const currentHeight = current.height || 0;
                return currentHeight >= bestHeight ? current : best;
              }, combinedFormats[0]);
              previewVideoUrl = bestFormat.url;
            } else {
              // Absolute fallback to last format
              previewVideoUrl = json.formats[json.formats.length - 1]?.url || null;
            }
          }

          // Parse timestamps
          let postedAt: string | null = null;
          if (json.timestamp) {
            postedAt = new Date(json.timestamp * 1000).toISOString();
          } else if (json.upload_date) {
            const y = json.upload_date.slice(0, 4);
            const m = json.upload_date.slice(4, 6);
            const d = json.upload_date.slice(6, 8);
            postedAt = new Date(`${y}-${m}-${d}`).toISOString();
          }

          const info: ReelInfo = {
            thumbnail: json.thumbnail || null,
            previewVideoUrl: previewVideoUrl || null,
            caption: json.description || json.title || null,
            author: json.uploader || json.channel || null,
            durationSec: typeof json.duration === 'number' ? json.duration : null,
            viewCount: typeof json.view_count === 'number' ? json.view_count : null,
            likeCount: typeof json.like_count === 'number' ? json.like_count : null,
            commentCount: typeof json.comment_count === 'number' ? json.comment_count : null,
            postedAt,
          };

          // Cache results
          cache.set(cleanUrl, {
            data: info,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });

          resolve(info);
        } catch (e: any) {
          console.error('[ReelInfo] JSON parse error:', e.message);
          reject(new Error('Failed to parse metadata from the video platform.'));
        }
      }
    );
  });
}
