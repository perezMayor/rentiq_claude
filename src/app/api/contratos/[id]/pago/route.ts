import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { PaymentMethod, ContractPayment } from '@/src/lib/types';

type Params = { params: Promise<{ id: string }> };

const VALID_METHODS: PaymentMethod[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'];

// POST /api/contratos/[id]/pago
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
      details: { action: 'PAGO' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const body = await req.json();
    const { method, amount, notes, isRefund } = body as {
      method: PaymentMethod;
      amount: number;
      notes?: string;
      isRefund?: boolean;
    };

    if (!method || !VALID_METHODS.includes(method)) {
      return NextResponse.json(
        { error: `Método de pago inválido. Valores válidos: ${VALID_METHODS.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount debe ser un número mayor que 0' }, { status: 400 });
    }

    const updated = withStoreWrite((store) => {
      const idx = store.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Contrato no encontrado'), { statusCode: 404 });
      }

      const current = store.contracts[idx];

      if (current.status !== 'ABIERTO') {
        throw Object.assign(
          new Error(`Solo se pueden registrar pagos en contratos ABIERTOS. Estado actual: ${current.status}`),
          { statusCode: 409 }
        );
      }

      const payment: ContractPayment = {
        id: generateId(),
        method,
        amount,
        notes,
        isRefund: isRefund === true,
        recordedAt: now,
        recordedBy: session.userId,
      };

      const refundLabel = isRefund === true ? ' (devolución)' : '';
      store.contracts[idx] = {
        ...current,
        payments: [...current.payments, payment],
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'PAGO',
            detail: `Pago registrado: ${amount.toFixed(2)} € (${method})${refundLabel}`,
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
      details: { action: 'PAGO', amount, method, isRefund: isRefund === true },
    });

    return NextResponse.json({ contract: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    console.error('[pago POST] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
