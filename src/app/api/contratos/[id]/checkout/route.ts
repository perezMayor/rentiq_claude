import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// POST /api/contratos/[id]/checkout
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
      details: { action: 'CHECKOUT' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const body = await req.json();
    const { kmOut, fuelOut, notes } = body as {
      kmOut: number;
      fuelOut: number;
      notes?: string;
    };

    if (kmOut === undefined || kmOut === null || typeof kmOut !== 'number' || kmOut < 0) {
      return NextResponse.json({ error: 'kmOut es obligatorio y debe ser un número >= 0' }, { status: 400 });
    }
    if (fuelOut === undefined || fuelOut === null || typeof fuelOut !== 'number' || fuelOut < 0 || fuelOut > 8 || !Number.isInteger(fuelOut)) {
      return NextResponse.json({ error: 'fuelOut es obligatorio y debe ser un entero entre 0 y 8' }, { status: 400 });
    }

    const updated = withStoreWrite((store) => {
      const idx = store.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Contrato no encontrado'), { statusCode: 404 });
      }

      const current = store.contracts[idx];

      if (current.status !== 'ABIERTO') {
        throw Object.assign(
          new Error(`Solo se puede registrar checkout en contratos ABIERTOS. Estado actual: ${current.status}`),
          { statusCode: 409 }
        );
      }

      if (current.checkout) {
        throw Object.assign(
          new Error('El checkout ya está registrado en este contrato'),
          { statusCode: 409 }
        );
      }

      store.contracts[idx] = {
        ...current,
        checkout: {
          doneAt: now,
          doneBy: session.userId,
          kmOut,
          fuelOut,
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
            action: 'CHECKOUT',
            detail: `Checkout registrado: km ${kmOut}, combustible ${fuelOut}/8`,
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
      details: { action: 'CHECKOUT', kmOut, fuelOut },
    });

    return NextResponse.json({ contract: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    console.error('[checkout POST] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
