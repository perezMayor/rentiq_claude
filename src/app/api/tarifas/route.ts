import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { TariffPlan } from '@/src/lib/types';


// GET /api/tarifas
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      details: { action: 'LIST' },
    });
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const plans = withStore((store) => [...store.tariffPlans]);
  return NextResponse.json({ plans });
}

// POST /api/tarifas
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, code, validFrom, validTo, active, graceHours } = body as {
      name: string;
      code: string;
      validFrom: string;
      validTo: string;
      active?: boolean;
      graceHours?: number | null;
    };

    if (!name || !code || !validFrom || !validTo) {
      return NextResponse.json(
        { error: 'Faltan campos: name, code, validFrom, validTo' },
        { status: 400 }
      );
    }
    if (validFrom >= validTo) {
      return NextResponse.json({ error: 'validFrom debe ser anterior a validTo' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const plan = withStoreWrite((store) => {
      const newPlan: TariffPlan = {
        id: generateId(),
        name,
        code,
        validFrom,
        validTo,
        active: active ?? true,
        ...(graceHours != null ? { graceHours } : {}),
        createdAt: now,
      };
      store.tariffPlans.push(newPlan);
      return newPlan;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      entityId: plan.id,
      details: { action: 'CREATE', name: plan.name },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
