import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/posts - Get list of queue posts
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || undefined;

    const posts = await prisma.post.findMany({
      where: status ? { status, userId } : { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            igUserId: true,
          },
        },
      },
    });

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts.' },
      { status: 500 }
    );
  }
}

// POST /api/posts - Create one or more posts
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    const body = await request.json();
    const {
      sourceUrl,
      channelIds,
      caption,
      watermark,
      scheduledAt,
    } = body;

    // Validation
    if (!sourceUrl) {
      return NextResponse.json({ error: 'Source video URL is required.' }, { status: 400 });
    }

    if (!sourceUrl.includes('instagram.com')) {
      return NextResponse.json({ error: 'URL must be a valid instagram.com link.' }, { status: 400 });
    }

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json({ error: 'At least one channel must be selected.' }, { status: 400 });
    }

    // Parse schedule date
    let scheduleDate: Date | null = null;
    if (scheduledAt) {
      scheduleDate = new Date(scheduledAt);
      if (isNaN(scheduleDate.getTime())) {
        return NextResponse.json({ error: 'Invalid schedule date.' }, { status: 400 });
      }
    } else {
      // Default to "post now" by setting scheduledAt to current time
      scheduleDate = new Date();
    }

    // Verify all channels exist and belong to this user
    const channels = await prisma.channel.findMany({
      where: {
        id: { in: channelIds },
        userId,
      },
    });

    if (channels.length !== channelIds.length) {
      return NextResponse.json({ error: 'One or more selected channels do not exist or do not belong to you.' }, { status: 400 });
    }

    // Create a Post row for each channel (fan out)
    const createdPosts = [];
    for (const channelId of channelIds) {
      const post = await prisma.post.create({
        data: {
          channelId,
          sourceUrl,
          status: 'queued',
          caption: caption || '',
          watermark: watermark !== undefined ? watermark : true,
          scheduledAt: scheduleDate,
          attempts: 0,
          userId,
        },
        include: {
          channel: {
            select: {
              name: true,
            },
          },
        },
      });
      createdPosts.push(post);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${createdPosts.length} post(s).`,
      posts: createdPosts,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create post(s):', error);
    return NextResponse.json(
      { error: 'Failed to queue post(s).' },
      { status: 500 }
    );
  }
}
