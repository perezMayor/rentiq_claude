import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';

interface ReservationSummary {
  id: string;
  number: string;
  startDate: string;
  endDate: string;
  total: number;
  status: string;
  contractId: string | undefined;
}

// ─── GET /api/clientes/[id]/reservas ────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  const clientExists = withStore((store) => store.clients.some((c) => c.id === id));
  if (!clientExists) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  }

  const reservations = withStore((store) => {
    const list = store.reservations
      .filter((r) => r.clientId === id)
      .map((r): ReservationSummary => ({
        id: r.id,
        number: r.number,
        startDate: r.startDate,
        endDate: r.endDate,
        total: r.total,
        status: r.status,
        contractId: r.contractId,
      }));

    list.sort((a, b) => {
      if (a.startDate < b.startDate) return 1;
      if (a.startDate > b.startDate) return -1;
      return 0;
    });

    return list;
  });

  return NextResponse.json({ reservations });
}
