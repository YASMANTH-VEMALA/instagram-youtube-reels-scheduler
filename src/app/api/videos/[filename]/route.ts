import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TMP_DIR = path.join(process.cwd(), 'tmp');

/**
 * Serves processed video files from the local tmp/ directory.
 * Instagram Graph API will fetch videos from this endpoint via the public (ngrok) URL.
 * This eliminates the need for Supabase Storage for video hosting.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Security: Only allow .mp4 files, no path traversal
  if (!filename.endsWith('.mp4') || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
  }

  const filePath = path.join(TMP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size.toString(),
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes',
    },
  });
}
