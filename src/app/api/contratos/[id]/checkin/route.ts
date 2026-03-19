import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// POST /api/contratos/[id]/checkin
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
      entity: 'Contract',
      details: { action: 'CHECKIN' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const body = await req.json();
    const { kmIn, fuelIn, notes } = body as {
      kmIn: number;
      fuelIn: number;
      notes?: string;
    };

    if (kmIn === undefined || kmIn === null || typeof kmIn !== 'number' || kmIn < 0) {
      return NextResponse.json({ error: 'kmIn es obligatorio y debe ser un número >= 0' }, { status: 400 });
    }
    if (fuelIn === undefined || fuelIn === null || typeof fuelIn !== 'number' || fuelIn < 0 || fuelIn > 8 || !Number.isInteger(fuelIn)) {
      return NextResponse.json({ error: 'fuelIn es obligatorio y debe ser un entero entre 0 y 8' }, { status: 400 });
    }

    const updated = withStoreWrite((store) => {
      const idx = store.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Contrato no encontrado'), { statusCode: 404 });
      }

      const current = store.contracts[idx];

      if (current.status !== 'ABIERTO') {
        throw Object.assign(
          new Error(`Solo se puede registrar checkin en contratos ABIERTOS. Estado actual: ${current.status}`),
          { statusCode: 409 }
        );
      }

      if (!current.checkout) {
        throw Object.assign(
          new Error('Debe registrar el checkout antes del checkin'),
          { statusCode: 409 }
        );
      }

      if (kmIn < current.checkout.kmOut) {
        throw Object.assign(
          new Error(`kmIn (${kmIn}) no puede ser menor que kmOut (${current.checkout.kmOut})`),
          { statusCode: 400 }
        );
      }

      store.contracts[idx] = {
        ...current,
        checkin: {
          doneAt: now,
          doneBy: session.userId,
          kmIn,
          fuelIn,
          notes,
          photoUrls: [],
          signatureUrl: undefined,
        },
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'CHECKIN',
            detail: `Checkin registrado: km ${kmIn}, combustible ${fuelIn}/8`,
          },
        ],
      };

      return store.contracts[idx];
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Contract',
      entityId: id,
      details: { action: 'CHECKIN', kmIn, fuelIn },
    });

    return NextResponse.json({ contract: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    console.error('[checkin POST] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
