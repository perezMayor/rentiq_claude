import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';

type Params = { params: Promise<{ id: string }> };

// GET /api/facturas/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;

  const result = withStore((store) => {
    const invoice = store.invoices.find((i) => i.id === id);
    if (!invoice) return null;

    const contract = store.contracts.find((c) => c.id === invoice.contractId);
    const client = store.clients.find((c) => c.id === invoice.clientId);
    const branch = store.branches.find((b) => b.id === invoice.branchId);

    return { invoice, contract, client, branch };
  });

  if (!result) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  }

  return NextResponse.json(result);
}
