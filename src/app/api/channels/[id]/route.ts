import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

// PUT /api/channels/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id')!;
    const { id } = await params;
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

    const existingChannel = await prisma.channel.findFirst({
      where: { id, userId },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found.' }, { status: 404 });
    }

    const updateData: any = {
      name: name !== undefined ? name : existingChannel.name,
      igUserId: igUserId !== undefined ? igUserId : existingChannel.igUserId,
      captionTemplate: captionTemplate !== undefined ? captionTemplate : existingChannel.captionTemplate,
      hashtags: hashtags !== undefined ? hashtags : existingChannel.hashtags,
      watermarkUrl: watermarkUrl !== undefined ? watermarkUrl : existingChannel.watermarkUrl,
      watermarkPosition: watermarkPosition !== undefined ? watermarkPosition : existingChannel.watermarkPosition,
      watermarkEnabledDefault: watermarkEnabledDefault !== undefined ? watermarkEnabledDefault : existingChannel.watermarkEnabledDefault,
      monsterlabCampaignId: monsterlabCampaignId !== undefined ? monsterlabCampaignId : existingChannel.monsterlabCampaignId,
    };

    // Only update and encrypt accessToken if it is provided and not empty
    if (accessToken) {
      updateData.accessToken = encrypt(accessToken);
    }

    const updatedChannel = await prisma.channel.update({
      where: { id },
      data: updateData,
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
      },
    });

    return NextResponse.json(updatedChannel);
  } catch (error: any) {
    console.error('Failed to update channel:', error);
    return NextResponse.json(
      { error: 'Failed to update channel.' },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id')!;
    const { id } = await params;

    const existingChannel = await prisma.channel.findFirst({
      where: { id, userId },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found.' }, { status: 404 });
    }

    await prisma.channel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Channel deleted successfully.' });
  } catch (error: any) {
    console.error('Failed to delete channel:', error);
    return NextResponse.json(
      { error: 'Failed to delete channel.' },
      { status: 500 }
    );
  }
}
