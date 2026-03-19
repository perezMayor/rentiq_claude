import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, SESSION_COOKIE } from '@/src/lib/auth';
import { appendEvent } from '@/src/lib/audit';

async function handleLogout(req: NextRequest) {
  const session = getSessionFromRequest(req);

  if (session) {
    await appendEvent({
      action: 'AUTH_LOGOUT',
      actorId: session.userId,
      actorRole: session.role,
    });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: '/login' },
  });

  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}
