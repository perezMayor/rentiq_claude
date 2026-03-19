import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';

// GET /api/facturas
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filterStatus = searchParams.get('status') ?? '';
  const filterBranchId = searchParams.get('branchId') ?? '';
  const filterClientId = searchParams.get('clientId') ?? '';
  const filterFrom = searchParams.get('from') ?? '';
  const filterTo = searchParams.get('to') ?? '';
  const filterSearch = searchParams.get('search') ?? '';

  const invoices = withStore((store) => {
    let list = [...store.invoices];

    if (filterStatus) list = list.filter((i) => i.status === filterStatus);
    if (filterBranchId) list = list.filter((i) => i.branchId === filterBranchId);
    if (filterClientId) list = list.filter((i) => i.clientId === filterClientId);
    if (filterFrom) list = list.filter((i) => i.date >= filterFrom);
    if (filterTo) list = list.filter((i) => i.date <= filterTo);

    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      // Get contracts and clients for search
      const contractMap = Object.fromEntries(store.contracts.map((c) => [c.id, c]));
      const clientMap = Object.fromEntries(
        store.clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`.toLowerCase()])
      );
      list = list.filter((i) => {
        if (i.number.toLowerCase().includes(q)) return true;
        const contract = contractMap[i.contractId];
        if (contract?.number.toLowerCase().includes(q)) return true;
        if (clientMap[i.clientId]?.includes(q)) return true;
        return false;
      });
    }

    // Sort by date desc, then number desc
    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.number.localeCompare(a.number);
    });

    return list;
  });

  return NextResponse.json({ invoices });
}
