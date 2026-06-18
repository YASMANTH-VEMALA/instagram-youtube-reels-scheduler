import { NextRequest, NextResponse } from 'next/server';
import { fetchReelInfo } from '@/lib/reelInfo';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Reel URL is required.' },
        { status: 400 }
      );
    }

    if (!url.includes('instagram.com')) {
      return NextResponse.json(
        { error: 'Invalid URL. Must be a valid instagram.com link.' },
        { status: 400 }
      );
    }

    try {
      const reelData = await fetchReelInfo(url);
      return NextResponse.json(reelData);
    } catch (fetchErr: any) {
      console.error('[ReelPreviewAPI] Fetch failed for URL:', url, fetchErr);
      return NextResponse.json(
        { error: fetchErr.message || 'Could not fetch this reel — it may be private or unavailable.' },
        { status: 422 }
      );
    }
  } catch (error: any) {
    console.error('[ReelPreviewAPI] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching preview.' },
      { status: 500 }
    );
  }
}
