import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import { sendReservationConfirmationEmail } from '@/src/lib/services/email-service';

type Params = { params: Promise<{ id: string }> };

// POST /api/reservas/[id]/confirmar
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
      details: { action: 'CONFIRMAR' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const updated = withStoreWrite((store) => {
      const idx = store.reservations.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error('Reserva no encontrada');

      const current = store.reservations[idx];
      if (current.status !== 'PETICION') {
        throw Object.assign(
          new Error(`No se puede confirmar una reserva en estado ${current.status}`),
          { statusCode: 409 }
        );
      }

      store.reservations[idx] = {
        ...current,
        status: 'CONFIRMADA',
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'CONFIRMAR',
            detail: 'Reserva confirmada',
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
      details: { action: 'CONFIRMAR', number: updated.number },
    });

    // Auto-send confirmation email (non-blocking — failure doesn't affect the response)
    const emailResult = await sendReservationConfirmationEmail(id);
    const emailSent = emailResult.ok;
    const emailError = emailResult.ok ? undefined : emailResult.error;

    return NextResponse.json({ reservation: updated, emailSent, emailError });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? (message === 'Reserva no encontrada' ? 404 : 500);
    return NextResponse.json({ error: message }, { status });
  }
}
