import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite, generateId, getNextInvoiceNumber } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { Invoice } from '@/src/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/contratos/[id]/cerrar
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
      details: { action: 'CERRAR' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  try {
    const result = withStoreWrite((store) => {
      const idx = store.contracts.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw Object.assign(new Error('Contrato no encontrado'), { statusCode: 404 });
      }

      const current = store.contracts[idx];

      if (current.status !== 'ABIERTO') {
        throw Object.assign(
          new Error(`Solo se pueden cerrar contratos ABIERTOS. Estado actual: ${current.status}`),
          { statusCode: 409 }
        );
      }

      if (!current.checkin) {
        throw Object.assign(
          new Error('El checkin debe estar registrado antes de cerrar el contrato'),
          { statusCode: 409 }
        );
      }

      // Calculate net paid amount
      const paid = current.payments
        .filter((p) => !p.isRefund)
        .reduce((sum, p) => sum + p.amount, 0);
      const refunded = current.payments
        .filter((p) => p.isRefund)
        .reduce((sum, p) => sum + p.amount, 0);
      const netPaid = paid - refunded;

      if (netPaid < current.total) {
        throw Object.assign(
          new Error(
            `Importe pendiente: ${(current.total - netPaid).toFixed(2)} €. El contrato no puede cerrarse con importe pendiente.`
          ),
          { statusCode: 409 }
        );
      }

      // Generate invoice
      const invoiceId = generateId();
      const invoiceNumber = getNextInvoiceNumber(store, current.branchId, 'F');

      const ivaPercent = store.settings.ivaPercent ?? 21;
      const taxableBase =
        current.basePrice +
        current.extrasTotal +
        current.insuranceTotal +
        current.fuelCharge +
        current.penalties -
        current.discount;
      const ivaAmount = Math.round(taxableBase * ivaPercent) / 100;
      const invoiceTotal = taxableBase + ivaAmount;

      const invoice: Invoice = {
        id: invoiceId,
        number: invoiceNumber,
        series: store.settings.invoiceSeries ?? 'F',
        branchId: current.branchId,
        contractId: current.id,
        clientId: current.clientId,
        type: 'F',
        date: today,
        baseAmount: current.basePrice,
        extrasAmount: current.extrasTotal,
        insuranceAmount: current.insuranceTotal,
        fuelAmount: current.fuelCharge,
        penalties: current.penalties,
        discount: current.discount,
        ivaPercent,
        ivaAmount,
        total: invoiceTotal,
        status: 'BORRADOR',
        sendLog: [],
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
      };

      store.invoices.push(invoice);

      store.contracts[idx] = {
        ...current,
        status: 'CERRADO',
        invoiceId: invoiceId,
        closedAt: now,
        closedBy: session.userId,
        updatedAt: now,
        auditLog: [
          ...current.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'CERRAR',
            detail: `Contrato cerrado. Factura generada: ${invoiceNumber}`,
          },
        ],
      };

      return { contract: store.contracts[idx], invoice };
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Contract',
      entityId: id,
      details: {
        action: 'CERRAR',
        invoiceId: result.invoice.id,
        invoiceNumber: result.invoice.number,
      },
    });

    return NextResponse.json({ contract: result.contract, invoice: result.invoice });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    console.error('[cerrar POST] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
