import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  let userPayload: any = null;
  if (token) {
    userPayload = await verifyJWT(token);
  }

  if (!userPayload) {
    // If request is for an API route, return 401 JSON response
    if (pathname.startsWith('/api/')) {
      // Exclude public APIs from authentication
      if (
        pathname !== '/api/login' &&
        pathname !== '/api/signup' &&
        !pathname.startsWith('/api/reset-password/') &&
        !pathname.startsWith('/api/videos/') &&
        !pathname.startsWith('/api/instagram/oauth/')
      ) {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized. Please login.' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        );
      }
      return NextResponse.next();
    }

    // Otherwise, redirect to login page
    if (pathname !== '/login') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // User is authenticated. Forward user headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', userPayload.id);
  requestHeaders.set('x-user-email', userPayload.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - login (login page)
     * - api/login, api/signup (auth APIs)
     * - favicon.ico, _next/static, _next/image, public assets
     */
    '/((?!login|api/login|api/signup|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};
