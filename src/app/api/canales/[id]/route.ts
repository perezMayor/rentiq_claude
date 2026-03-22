import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// PUT /api/canales/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'SalesChannel', details: { action: 'UPDATE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { name, commissionPercent, active } = body as { name?: string; commissionPercent?: number; active?: boolean };

    const updated = withStoreWrite((store) => {
      const ch = store.salesChannels.find((c) => c.id === id);
      if (!ch) throw new Error('Canal no encontrado');
      if (name !== undefined) ch.name = name.trim();
      if (commissionPercent !== undefined) ch.commissionPercent = commissionPercent;
      if (active !== undefined) ch.active = active;
      return { ...ch };
    });

    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'SalesChannel', entityId: id, details: { action: 'UPDATE' } });
    return NextResponse.json({ channel: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/canales/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'SalesChannel', details: { action: 'DELETE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    withStoreWrite((store) => {
      const idx = store.salesChannels.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Canal no encontrado');
      const inUse = store.reservations.some((r) => r.salesChannelId === id);
      if (inUse) throw new Error('No se puede eliminar: el canal está en uso en reservas existentes');
      store.salesChannels.splice(idx, 1);
    });

    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'SalesChannel', entityId: id, details: { action: 'DELETE' } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
