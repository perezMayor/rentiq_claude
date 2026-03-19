import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// POST /api/reservas/[id]/cancelar
export async function POST(req: NextRequest, { params }: Params) {
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
      details: { action: 'CANCELAR' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const body = await req.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    const updated = withStoreWrite((store) => {
      const idx = store.reservations.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error('Reserva no encontrada');

      const current = store.reservations[idx];
      if (current.status === 'CANCELADA') {
        throw Object.assign(new Error('La reserva ya está cancelada'), { statusCode: 409 });
      }
      if (current.contractId) {
        throw Object.assign(
          new Error('No se puede cancelar una reserva con contrato asociado activo'),
          { statusCode: 409 }
        );
      }

      store.reservations[idx] = {
        ...current,
        status: 'CANCELADA',
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'CANCELAR',
            detail: reason ? `Cancelada: ${reason}` : 'Reserva cancelada',
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
      details: { action: 'CANCELAR', reason, number: updated.number },
    });

    return NextResponse.json({ reservation: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? (message === 'Reserva no encontrada' ? 404 : 500);
    return NextResponse.json({ error: message }, { status });
  }
}
