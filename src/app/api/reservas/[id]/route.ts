import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// GET /api/reservas/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  const reservation = withStore((store) =>
    store.reservations.find((r) => r.id === id) ?? null
  );

  if (!reservation) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ reservation });
}

// PUT /api/reservas/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Reservation',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const now = new Date().toISOString();

    const updated = withStoreWrite((store) => {
      const idx = store.reservations.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error('Reserva no encontrada');

      const current = store.reservations[idx];

      // Cannot change status here — use /confirmar or /cancelar
      const { status: _status, contractId: _cid, number: _num, id: _id, ...allowedUpdates } = body;

      store.reservations[idx] = {
        ...current,
        ...allowedUpdates,
        id: current.id,
        number: current.number,
        status: current.status,
        contractId: current.contractId,
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'UPDATE',
            detail: 'Reserva actualizada',
          },
        ],
      };

      return store.reservations[idx];
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Reservation',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ reservation: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    const status = message === 'Reserva no encontrada' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/reservas/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Reservation',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  try {
    withStoreWrite((store) => {
      const reservation = store.reservations.find((r) => r.id === id);
      if (!reservation) throw new Error('Reserva no encontrada');

      // Critical rule: cannot delete if has contract
      if (reservation.contractId) {
        throw Object.assign(new Error('No se puede eliminar una reserva con contrato asociado'), {
          statusCode: 409,
        });
      }

      store.reservations = store.reservations.filter((r) => r.id !== id);
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Reservation',
      entityId: id,
      details: { action: 'DELETE' },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? (message === 'Reserva no encontrada' ? 404 : 500);
    return NextResponse.json({ error: message }, { status });
  }
}
