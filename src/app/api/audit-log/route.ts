import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isSuperAdmin } from '@/src/lib/auth';
import { getEvents, suppressEvent } from '@/src/lib/audit';

// GET /api/audit-log — list audit events
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);

  try {
    const events = await getEvents(limit);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('[audit-log GET] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/audit-log — suppress event (SUPER_ADMIN only)
export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!isSuperAdmin(session.role)) {
    return NextResponse.json({ error: 'Requiere rol SUPER_ADMIN' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { eventId, reason } = body as { eventId: string; reason?: string };
    if (!eventId) {
      return NextResponse.json({ error: 'eventId requerido' }, { status: 400 });
    }

    await suppressEvent(eventId, session.userId, reason);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
