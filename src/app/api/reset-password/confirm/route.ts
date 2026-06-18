import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyJWT, hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and new password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    // Verify reset token
    const decoded = await verifyJWT(token);
    if (!decoded || decoded.purpose !== 'password-reset' || !decoded.email) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new link.' },
        { status: 400 }
      );
    }

    const email = decoded.email.toLowerCase();

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Associated user account not found.' },
        { status: 404 }
      );
    }

    // Hash and update password
    const hashed = hashPassword(password);
    await prisma.user.update({
      where: { email },
      data: { passwordHash: hashed },
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully. You can now log in.',
    });
  } catch (error: any) {
    console.error('Password reset confirm error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
