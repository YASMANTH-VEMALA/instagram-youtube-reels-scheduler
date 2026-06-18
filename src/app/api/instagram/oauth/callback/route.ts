import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';

function popupResponse(success: boolean, message: string, requestUrl: string) {
  const targetOrigin = new URL(requestUrl).origin;
  const type = success ? 'INSTAGRAM_AUTH_SUCCESS' : 'INSTAGRAM_AUTH_ERROR';
  const redirectParam = success ? 'success' : 'error';
  const redirectUrl = `/channels?${redirectParam}=${encodeURIComponent(message)}`;

  return new NextResponse(
    `<!DOCTYPE html>
    <html>
    <head>
      <title>Authentication ${success ? 'Complete' : 'Failed'}</title>
      <style>
        body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #333; }
        .card { text-align: center; padding: 24px; background: white; border: 1px solid #ddd; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
      </style>
    </head>
    <body>
      <div class="card">
        <p style="font-weight: bold; font-size: 16px;">${success ? '✓ Connected successfully!' : '✗ Connection failed.'}</p>
        <p>${message}</p>
        <p style="color: #888; font-size: 12px;">Closing window...</p>
      </div>
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage({
              type: ${JSON.stringify(type)},
              message: ${JSON.stringify(message)}
            }, ${JSON.stringify(targetOrigin)});
            setTimeout(() => window.close(), 1500);
          } else {
            window.location.href = ${JSON.stringify(redirectUrl)};
          }
        } catch (e) {
          window.location.href = ${JSON.stringify(redirectUrl)};
        }
      </script>
    </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const stateParam = searchParams.get('state');

  // 1. Handle OAuth authentication error from Instagram
  if (error || !code) {
    console.error('Instagram OAuth Error:', error, errorDescription);
    return popupResponse(false, errorDescription || 'Failed to authenticate with Instagram.', request.url);
  }

  // 2. Retrieve and verify the user session.
  // Primary: auth_token cookie (works when callback is on same domain as app).
  // Fallback: JWT embedded in the OAuth state param (needed when Instagram redirects
  // to an ngrok domain different from localhost where the cookie was set).
  let token = request.cookies.get('auth_token')?.value;

  if (!token && stateParam) {
    try {
      const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf8'));
      token = decoded.token || undefined;
    } catch {
      // state param malformed — fall through to session expired error
    }
  }

  if (!token) {
    return popupResponse(false, 'Session expired. Please log in again.', request.url);
  }

  const userPayload = await verifyJWT(token);
  if (!userPayload || !userPayload.id) {
    return popupResponse(false, 'Session expired. Please log in again.', request.url);
  }
  const userId = userPayload.id;

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    return popupResponse(false, 'Instagram App Credentials are not configured on the server.', request.url);
  }

  // Strip trailing hash parameter added by Instagram on redirect if present
  let cleanCode = code;
  if (cleanCode.endsWith('#_')) {
    cleanCode = cleanCode.substring(0, cleanCode.length - 2);
  }

  try {
    // 3. Exchange authorization code for a short-lived access token
    const tokenFormData = new URLSearchParams();
    tokenFormData.append('client_id', appId);
    tokenFormData.append('client_secret', appSecret);
    tokenFormData.append('grant_type', 'authorization_code');
    tokenFormData.append('redirect_uri', redirectUri);
    tokenFormData.append('code', cleanCode);

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenFormData.toString(),
    });
    
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_message || tokenData.error?.message || 'Failed to retrieve user access token.');
    }

    const shortLivedToken = tokenData.access_token;

    // 4. Exchange short-lived token for a long-lived (60 days) access token
    const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortLivedToken}`;
    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    if (!longLivedResponse.ok || !longLivedData.access_token) {
      throw new Error(longLivedData.error?.message || 'Failed to retrieve long-lived access token.');
    }

    const longLivedToken = longLivedData.access_token;
    const expiresSeconds = longLivedData.expires_in || (60 * 24 * 60 * 60);
    const tokenExpiresAt = new Date(Date.now() + expiresSeconds * 1000);

    // 5. Get Instagram user profile details directly
    const meUrl = `https://graph.instagram.com/v19.0/me?fields=user_id,username&access_token=${longLivedToken}`;
    const meResponse = await fetch(meUrl);
    const meData = await meResponse.json();

    if (!meResponse.ok || !meData.user_id) {
      throw new Error(meData.error?.message || 'Failed to retrieve Instagram profile details.');
    }

    const igUserId = meData.user_id;
    const name = meData.username;

    // Encrypt access token before storing
    const encryptedToken = encrypt(longLivedToken);

    // 6. Upsert the channel in DB scoped to the active user
    await prisma.channel.upsert({
      where: { id: `ig_${igUserId}` },
      update: {
        name,
        igUserId,
        accessToken: encryptedToken,
        tokenExpiresAt,
        userId,
      },
      create: {
        id: `ig_${igUserId}`,
        name,
        igUserId,
        accessToken: encryptedToken,
        tokenExpiresAt,
        userId,
      },
    });

    return popupResponse(true, `Connected account: ${name}`, request.url);
  } catch (err: any) {
    console.error('Instagram OAuth Callback processing failed:', err);
    return popupResponse(false, err.message || 'An error occurred during channel connection.', request.url);
  }
}
