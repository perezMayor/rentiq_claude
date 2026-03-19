import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';
import type { ContractStatus } from '@/src/lib/types';

// GET /api/contratos — list contracts with filters
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as ContractStatus | null;
  const branchId = url.searchParams.get('branchId');
  const clientId = url.searchParams.get('clientId');
  const plate = url.searchParams.get('plate');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const search = url.searchParams.get('search')?.toLowerCase();

  const data = withStore((store) => {
    let list = [...store.contracts];

    if (status) {
      list = list.filter((c) => c.status === status);
    }
    if (branchId) {
      list = list.filter((c) => c.branchId === branchId);
    }
    if (clientId) {
      list = list.filter((c) => c.clientId === clientId);
    }
    if (plate) {
      list = list.filter((c) => c.plate.toLowerCase().includes(plate.toLowerCase()));
    }
    if (from) {
      list = list.filter((c) => c.startDate >= from);
    }
    if (to) {
      list = list.filter((c) => c.startDate <= to);
    }
    if (search) {
      const clientMap = Object.fromEntries(
        store.clients.map((cl) => [
          cl.id,
          `${cl.name}${cl.surname ? ' ' + cl.surname : ''}`.toLowerCase(),
        ])
      );
      list = list.filter(
        (c) =>
          c.number.toLowerCase().includes(search) ||
          c.plate.toLowerCase().includes(search) ||
          (clientMap[c.clientId] ?? '').includes(search)
      );
    }

    // Sort by startDate desc, then by number desc
    list.sort((a, b) => {
      const dateComp = b.startDate.localeCompare(a.startDate);
      if (dateComp !== 0) return dateComp;
      return b.number.localeCompare(a.number);
    });

    return list;
  });

  return NextResponse.json({ contracts: data });
}

// POST /api/contratos — not used (contracts are created via /reservas/[id]/convertir)
export async function POST() {
  return NextResponse.json(
    { error: 'Use POST /api/reservas/[id]/convertir to create contracts' },
    { status: 405 }
  );
}
