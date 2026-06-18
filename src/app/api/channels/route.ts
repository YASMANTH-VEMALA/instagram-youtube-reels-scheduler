import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

// GET /api/channels
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    const channels = await prisma.channel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        igUserId: true,
        tokenExpiresAt: true,
        captionTemplate: true,
        hashtags: true,
        watermarkUrl: true,
        watermarkPosition: true,
        watermarkEnabledDefault: true,
        monsterlabCampaignId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(channels);
  } catch (error: any) {
    console.error('Failed to fetch channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels.' },
      { status: 500 }
    );
  }
}

// POST /api/channels
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')!;

    const body = await request.json();
    const {
      name,
      igUserId,
      accessToken,
      captionTemplate,
      hashtags,
      watermarkUrl,
      watermarkPosition,
      watermarkEnabledDefault,
      monsterlabCampaignId,
    } = body;

    if (!name || !igUserId || !accessToken) {
      return NextResponse.json(
        { error: 'Name, Instagram User ID, and Access Token are required.' },
        { status: 400 }
      );
    }

    // Encrypt token
    const encryptedToken = encrypt(accessToken);

    const channel = await prisma.channel.create({
      data: {
        name,
        igUserId,
        accessToken: encryptedToken,
        captionTemplate: captionTemplate || '',
        hashtags: hashtags || '',
        watermarkUrl: watermarkUrl || null,
        watermarkPosition: watermarkPosition || 'bottom-right',
        watermarkEnabledDefault: watermarkEnabledDefault !== undefined ? watermarkEnabledDefault : true,
        monsterlabCampaignId: monsterlabCampaignId || null,
        userId,
      },
      select: {
        id: true,
        name: true,
        igUserId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create channel:', error);
    return NextResponse.json(
      { error: 'Failed to create channel.' },
      { status: 500 }
    );
  }
}
