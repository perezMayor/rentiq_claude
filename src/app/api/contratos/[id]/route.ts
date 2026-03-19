import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// GET /api/contratos/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  const contract = withStore((store) => store.contracts.find((c) => c.id === id) ?? null);
  if (!contract) {
    return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ contract });
}

// PUT /api/contratos/[id] — update editable fields (notes, plate if ABIERTO)
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
      entity: 'Contract',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const body = await req.json();
    const { notes, plate } = body as { notes?: string; plate?: string };

    const updated = withStoreWrite((store) => {
      const idx = store.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Contrato no encontrado'), { statusCode: 404 });
      }

      const current = store.contracts[idx];

      if (current.status !== 'ABIERTO') {
        throw Object.assign(
          new Error(`No se puede modificar un contrato en estado ${current.status}`),
          { statusCode: 409 }
        );
      }

      store.contracts[idx] = {
        ...current,
        notes: notes !== undefined ? notes : current.notes,
        plate: plate !== undefined ? plate : current.plate,
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'UPDATE',
            detail: 'Contrato actualizado',
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
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ contract: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/contratos/[id] — only if ABIERTO and no invoiceId
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
      entity: 'Contract',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    withStoreWrite((store) => {
      const idx = store.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Contrato no encontrado'), { statusCode: 404 });
      }

      const contract = store.contracts[idx];

      if (contract.status !== 'ABIERTO') {
        throw Object.assign(
          new Error(`Solo se pueden eliminar contratos ABIERTOS. Estado actual: ${contract.status}`),
          { statusCode: 409 }
        );
      }

      if (contract.invoiceId) {
        throw Object.assign(
          new Error('No se puede eliminar un contrato con factura generada'),
          { statusCode: 409 }
        );
      }

      // Clear bidirectional link on reservation
      const resIdx = store.reservations.findIndex((r) => r.id === contract.reservationId);
      if (resIdx !== -1) {
        const res = store.reservations[resIdx];
        store.reservations[resIdx] = {
          ...res,
          contractId: undefined,
          updatedAt: now,
          auditLog: [
            ...res.auditLog,
            {
              at: now,
              by: session.userId,
              action: 'UNLINK_CONTRACT',
              detail: `Contrato ${contract.number} eliminado`,
            },
          ],
        };
      }

      store.contracts.splice(idx, 1);
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Contract',
      entityId: id,
      details: { action: 'DELETE' },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
