import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// POST /api/contratos/[id]/cancelar
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
      const idx = store.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Contrato no encontrado'), { statusCode: 404 });
      }

      const current = store.contracts[idx];

      if (current.status !== 'ABIERTO') {
        throw Object.assign(
          new Error(`Solo se pueden cancelar contratos ABIERTOS. Estado actual: ${current.status}`),
          { statusCode: 409 }
        );
      }

      store.contracts[idx] = {
        ...current,
        status: 'CANCELADO',
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'CANCELAR',
            detail: reason ? `Contrato cancelado: ${reason}` : 'Contrato cancelado',
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
      details: { action: 'CANCELAR', reason },
    });

    return NextResponse.json({ contract: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    console.error('[cancelar POST] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
