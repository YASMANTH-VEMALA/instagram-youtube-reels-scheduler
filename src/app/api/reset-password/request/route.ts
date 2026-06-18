import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signJWT } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // For security reasons, do not explicitly disclose if an email is registered or not
      return NextResponse.json({
        success: true,
        message: 'Password reset flow initiated.',
        mock: false,
      });
    }

    // Generate a temporary reset token (valid for 15 minutes)
    const token = await signJWT({
      email: user.email,
      purpose: 'password-reset',
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset flow initiated.',
      token,
      email: user.email,
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
