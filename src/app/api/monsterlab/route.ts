import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMonsterLabAccount, getMonsterLabCampaigns } from '@/lib/monsterlab';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;
    const apiKey = process.env.MONSTERLAB_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        configured: false,
        error: 'MonsterLab API key is not configured in the server .env file.',
      });
    }

    // 1. Fetch MonsterLab account and campaigns in parallel (catch errors to prevent blocking everything)
    let account = null;
    let campaigns: any[] = [];
    let apiError = null;

    try {
      const [accData, campData] = await Promise.all([
        getMonsterLabAccount(apiKey),
        getMonsterLabCampaigns(apiKey),
      ]);
      account = accData;
      campaigns = campData;
    } catch (err: any) {
      console.error('MonsterLab API call failed:', err);
      apiError = err.message || String(err);
    }

    // 2. Fetch submissions from our local DB
    const submissions = await prisma.post.findMany({
      where: {
        userId,
        monsterlabClipId: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        sourceUrl: true,
        caption: true,
        publishedAt: true,
        igMediaId: true,
        monsterlabClipId: true,
        monsterlabStatus: true,
        monsterlabViews: true,
        monsterlabEarnings: true,
        channel: {
          select: {
            name: true,
            igUserId: true,
            monsterlabCampaignId: true,
          },
        },
      },
    });

    return NextResponse.json({
      configured: true,
      apiError,
      account,
      campaigns,
      submissions,
    });
  } catch (error: any) {
    console.error('Failed to load MonsterLab dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error loading dashboard data.' },
      { status: 500 }
    );
  }
}
