import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// POST /api/facturas/[id]/finalizar
// Transitions invoice from BORRADOR → FINAL
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
      entity: 'Invoice',
      details: { action: 'FINALIZAR' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const invoice = withStoreWrite((store) => {
      const idx = store.invoices.findIndex((i) => i.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Factura no encontrada'), { statusCode: 404 });
      }

      const inv = store.invoices[idx];
      if (inv.status !== 'BORRADOR') {
        throw Object.assign(
          new Error(`Solo se pueden finalizar facturas en BORRADOR. Estado actual: ${inv.status}`),
          { statusCode: 409 }
        );
      }

      store.invoices[idx] = { ...inv, status: 'FINAL', updatedAt: now };
      return store.invoices[idx];
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Invoice',
      entityId: id,
      details: { action: 'FINALIZAR', number: invoice.number },
    });

    return NextResponse.json({ invoice });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json(
      { error: error.message ?? 'Error interno' },
      { status: error.statusCode ?? 500 }
    );
  }
}
