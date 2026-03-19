import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from './lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login', '/api/rbac-denied'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/brand') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  const session = getSessionFromRequest(req);

  // No valid session → redirect to login
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // LECTOR role restriction
  if (session.role === 'LECTOR') {
    const restricted = ['/tarifas', '/gestor', '/auditoria'];
    if (restricted.some((r) => pathname.startsWith(r))) {
      // Redirect through /api/rbac-denied so the audit event is written
      // by a Node.js route handler (middleware runs on Edge — no fs access).
      const auditUrl = new URL('/api/rbac-denied', req.url);
      auditUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(auditUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
