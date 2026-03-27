import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// GET /api/promocodes/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const promoCode = withStore((store) => (store.promoCodes ?? []).find((p) => p.id === id) ?? null);
  if (!promoCode) return NextResponse.json({ error: 'Código promocional no encontrado' }, { status: 404 });

  return NextResponse.json({ promoCode });
}

// PUT /api/promocodes/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'PromoCode', details: { action: 'UPDATE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json() as Record<string, unknown>;

    const updated = withStoreWrite((store) => {
      if (!store.promoCodes) store.promoCodes = [];
      const idx = store.promoCodes.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error('Código promocional no encontrado');

      const existing = store.promoCodes[idx];

      // If code is being changed, check uniqueness
      if (body.code && typeof body.code === 'string') {
        const codeUpper = body.code.trim().toUpperCase();
        const conflict = store.promoCodes.find((p) => p.code === codeUpper && p.id !== id);
        if (conflict) throw new Error(`Ya existe un código con el valor ${codeUpper}`);
        body.code = codeUpper;
      }

      // id, createdAt and usedCount are immutable via PUT
      const { id: _id, createdAt: _ca, usedCount: _uc, ...rest } = body as {
        id?: unknown; createdAt?: unknown; usedCount?: unknown; [key: string]: unknown;
      };

      const merged = {
        ...existing,
        ...(rest as Partial<typeof existing>),
        id: existing.id,
        createdAt: existing.createdAt,
        usedCount: existing.usedCount,
        updatedAt: new Date().toISOString(),
      };

      store.promoCodes[idx] = merged;
      return merged;
    });

    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'PromoCode', entityId: id, details: { action: 'UPDATE' } });
    return NextResponse.json({ promoCode: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/promocodes/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'PromoCode', details: { action: 'DELETE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;

    withStoreWrite((store) => {
      if (!store.promoCodes) store.promoCodes = [];
      const idx = store.promoCodes.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error('Código promocional no encontrado');

      const promo = store.promoCodes[idx];

      if (promo.usedCount > 0) {
        // Has been used — logical delete only (set active = false)
        store.promoCodes[idx] = { ...promo, active: false, updatedAt: new Date().toISOString() };
      } else {
        // Never used — physical delete
        store.promoCodes.splice(idx, 1);
      }
    });

    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'PromoCode', entityId: id, details: { action: 'DELETE' } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
