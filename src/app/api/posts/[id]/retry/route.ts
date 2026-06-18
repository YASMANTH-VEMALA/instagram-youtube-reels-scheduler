import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id')!;
    const { id } = await params;

    const post = await prisma.post.findFirst({
      where: { id, userId },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
    }

    if (post.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed posts can be retried.' },
        { status: 400 }
      );
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        status: 'queued',
        attempts: 0,
        error: null,
        scheduledAt: new Date(), // run immediately
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Post successfully queued for retry.',
      post: updatedPost,
    });
  } catch (error: any) {
    console.error('Failed to retry post:', error);
    return NextResponse.json(
      { error: 'Failed to retry post.' },
      { status: 500 }
    );
  }
}
