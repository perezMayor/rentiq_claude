import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { appendEvent } from '@/src/lib/audit';

// GET /api/rbac-denied?from=<path>
// Called by middleware when a LECTOR tries to access a restricted route.
// Writes the RBAC_DENIED audit event (requires Node.js runtime — not Edge)
// then redirects to /dashboard.
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  const from = new URL(req.url).searchParams.get('from') ?? 'unknown';

  if (session) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Route',
      entityId: from,
      details: { path: from },
    });
  }

  return NextResponse.redirect(new URL('/dashboard', req.url));
}
