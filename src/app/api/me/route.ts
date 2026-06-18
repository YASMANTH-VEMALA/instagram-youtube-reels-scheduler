import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const email = request.headers.get('x-user-email') || '';
  const id = request.headers.get('x-user-id') || '';

  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse the username from the email address (e.g., admin from admin@clipping.com)
  const username = email.split('@')[0] || 'User';

  return NextResponse.json({
    id,
    email,
    username,
  });
}
