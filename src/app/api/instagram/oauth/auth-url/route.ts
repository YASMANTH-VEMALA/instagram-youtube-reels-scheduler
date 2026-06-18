import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const appId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    
    const envScopes = process.env.INSTAGRAM_OAUTH_SCOPES 
      ? process.env.INSTAGRAM_OAUTH_SCOPES.split(',') 
      : ['instagram_business_basic', 'instagram_business_content_publish'];
    
    // Deduplicate scopes and ensure we only pass Instagram scopes
    const scopesList = Array.from(new Set(envScopes)).join(',');

    if (!appId || !redirectUri) {
      return NextResponse.json(
        { error: 'Instagram App Credentials are not fully configured in the environment.' },
        { status: 500 }
      );
    }

    // Pass the auth token in the OAuth state param so the callback can identify
    // the user even when Instagram redirects to a different domain (ngrok vs localhost)
    // where the browser won't send the original localhost cookie.
    const authToken = request.cookies.get('auth_token')?.value || '';
    const state = Buffer.from(JSON.stringify({ token: authToken })).toString('base64url');

    // Modern Instagram Login Authorization endpoint
    const instagramAuthUrl = `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopesList)}&response_type=code&state=${encodeURIComponent(state)}`;

    return NextResponse.json({ url: instagramAuthUrl });
  } catch (error: any) {
    console.error('Failed to generate Instagram OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL.' },
      { status: 500 }
    );
  }
}
