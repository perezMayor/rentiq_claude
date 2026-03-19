import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { appendEvent } from '@/src/lib/audit';

// Actions that clients are allowed to submit manually.
// System actions (RBAC_DENIED, AUDIT_SUPPRESS, AUTH_*) are written server-side only.
const USER_SUBMITTABLE_ACTIONS = ['UI_OPEN_MODULE', 'SYSTEM'] as const;
type UserSubmittableAction = (typeof USER_SUBMITTABLE_ACTIONS)[number];

// POST /api/audit — append a user-initiated audit event
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, entity, entityId, details } = body as {
      action: string;
      entity?: string;
      entityId?: string;
      details?: Record<string, unknown>;
    };

    if (!action) {
      return NextResponse.json({ error: 'action requerido' }, { status: 400 });
    }

    if (!USER_SUBMITTABLE_ACTIONS.includes(action as UserSubmittableAction)) {
      return NextResponse.json(
        { error: `Acción no permitida vía API: ${action}` },
        { status: 400 }
      );
    }

    await appendEvent({
      action: action as UserSubmittableAction,
      actorId: session.userId,
      actorRole: session.role,
      entity,
      entityId,
      details,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[audit POST] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
