import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// GET /api/tarifas/[id]
// Returns plan + brackets + prices + categories
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const { id } = await params;

  const result = withStore((store) => {
    const plan = store.tariffPlans.find((p) => p.id === id);
    if (!plan) return null;

    const brackets = store.tariffBrackets
      .filter((b) => b.planId === id)
      .sort((a, b) => a.order - b.order);

    const prices = store.tariffPrices.filter((p) => p.planId === id);
    const categories = [...store.vehicleCategories];

    return { plan, brackets, prices, categories };
  });

  if (!result) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });
  return NextResponse.json(result);
}

// PUT /api/tarifas/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, code, validFrom, validTo, active, graceHours } = body as {
      name?: string;
      code?: string;
      validFrom?: string;
      validTo?: string;
      active?: boolean;
      graceHours?: number | null;
    };

    const updated = withStoreWrite((store) => {
      const idx = store.tariffPlans.findIndex((p) => p.id === id);
      if (idx === -1) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });
      const plan = store.tariffPlans[idx];
      if (name) plan.name = name;
      if (code) plan.code = code;
      if (validFrom) plan.validFrom = validFrom;
      if (validTo) plan.validTo = validTo;
      if (active !== undefined) plan.active = active;
      if (graceHours !== undefined) plan.graceHours = graceHours ?? undefined;
      return plan;
    });

    return NextResponse.json({ plan: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: error.statusCode ?? 500 });
  }
}

// DELETE /api/tarifas/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  withStoreWrite((store) => {
    const idx = store.tariffPlans.findIndex((p) => p.id === id);
    if (idx === -1) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });
    store.tariffPlans.splice(idx, 1);
    // Cascade: remove brackets and prices for this plan
    store.tariffBrackets = store.tariffBrackets.filter((b) => b.planId !== id);
    store.tariffPrices = store.tariffPrices.filter((p) => p.planId !== id);
  });

  await appendEvent({
    action: 'SYSTEM',
    actorId: session.userId,
    actorRole: session.role,
    entity: 'TariffPlan',
    entityId: id,
    details: { action: 'DELETE' },
  });

  return NextResponse.json({ ok: true });
}
