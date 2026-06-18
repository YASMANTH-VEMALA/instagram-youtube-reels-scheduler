import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * SSE endpoint that streams real-time log entries for a specific post.
 * The client connects and receives log entries as they are written by the worker.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const userId = request.headers.get('x-user-id')!;

  // Verify the post exists and belongs to the user
  const post = await prisma.post.findFirst({
    where: { id: postId, userId },
    select: { id: true, status: true },
  });

  if (!post) {
    return new Response(JSON.stringify({ error: 'Post not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      let lastLogId: string | null = null;

      const sendEvent = (data: any) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cancelled = true;
        }
      };

      // Send existing logs first
      const existingLogs = await prisma.postLog.findMany({
        where: { postId },
        orderBy: { createdAt: 'asc' },
      });

      if (existingLogs.length > 0) {
        for (const log of existingLogs) {
          sendEvent({
            type: 'log',
            log: {
              id: log.id,
              step: log.step,
              message: log.message,
              level: log.level,
              createdAt: log.createdAt.toISOString(),
            },
          });
        }
        lastLogId = existingLogs[existingLogs.length - 1].id;
      }

      // Send current status
      const currentPost = await prisma.post.findUnique({
        where: { id: postId },
        select: { status: true, error: true },
      });
      sendEvent({ type: 'status', status: currentPost?.status, error: currentPost?.error });

      // Poll for new logs every 1 second
      const interval = setInterval(async () => {
        if (cancelled) {
          clearInterval(interval);
          return;
        }

        try {
          const newLogs = await prisma.postLog.findMany({
            where: {
              postId,
              ...(lastLogId ? {
                createdAt: {
                  gt: (await prisma.postLog.findUnique({ where: { id: lastLogId } }))?.createdAt || new Date(0),
                },
              } : {}),
            },
            orderBy: { createdAt: 'asc' },
          });

          for (const log of newLogs) {
            if (log.id !== lastLogId) {
              sendEvent({
                type: 'log',
                log: {
                  id: log.id,
                  step: log.step,
                  message: log.message,
                  level: log.level,
                  createdAt: log.createdAt.toISOString(),
                },
              });
              lastLogId = log.id;
            }
          }

          // Check post status for completion
          const updatedPost = await prisma.post.findUnique({
            where: { id: postId },
            select: { status: true, error: true },
          });

          if (updatedPost) {
            sendEvent({ type: 'status', status: updatedPost.status, error: updatedPost.error });

            // Close stream if post reached a terminal state
            if (['published', 'failed'].includes(updatedPost.status)) {
              clearInterval(interval);
              if (!cancelled) {
                sendEvent({ type: 'done' });
                controller.close();
              }
            }
          }
        } catch (err) {
          console.error('[SSE] Error polling logs:', err);
        }
      }, 1000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        cancelled = true;
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
