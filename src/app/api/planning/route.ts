import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';

// GET /api/planning — returns grid data
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const today = new Date().toISOString().split('T')[0];
  const from = url.searchParams.get('from') ?? today;
  const daysParam = url.searchParams.get('days');
  const days = daysParam === '60' ? 60 : daysParam === '90' ? 90 : 30;
  const branchId = url.searchParams.get('branchId');
  const categoryId = url.searchParams.get('categoryId');
  const plate = url.searchParams.get('plate')?.toLowerCase();
  const location = url.searchParams.get('location')?.toLowerCase();

  const fromDate = new Date(from + 'T12:00:00');
  const toDate = new Date(fromDate);
  toDate.setDate(fromDate.getDate() + days - 1);
  const to = toDate.toISOString().split('T')[0];

  const data = withStore((store) => {
    let vehicles = store.vehicles.filter((v) => v.active);
    if (branchId) vehicles = vehicles.filter((v) => v.branchId === branchId);
    if (categoryId) vehicles = vehicles.filter((v) => v.categoryId === categoryId);
    if (plate) vehicles = vehicles.filter((v) => v.plate.toLowerCase().includes(plate));

    const vehicleOut = vehicles.map((v) => {
      const model = store.vehicleModels.find((m) => m.id === v.modelId);
      const category = store.vehicleCategories.find((c) => c.id === v.categoryId);
      return {
        plate: v.plate,
        modelName: model ? `${model.brand} ${model.model}` : v.modelId,
        categoryId: v.categoryId,
        categoryName: category?.name ?? v.categoryId,
        branchId: v.branchId,
      };
    });

    const activePlates = new Set(vehicleOut.map((v) => v.plate));

    function buildClientName(clientId: string) {
      const client = store.clients.find((c) => c.id === clientId);
      if (!client) return clientId;
      return client.type === 'EMPRESA' && client.companyName
        ? client.companyName
        : client.surname
        ? `${client.name} ${client.surname}`
        : client.name;
    }

    const reservationOut = store.reservations
      .filter((r) => {
        if (!r.assignedPlate) return false;
        if (!activePlates.has(r.assignedPlate)) return false;
        if (r.status === 'CANCELADA') return false;
        if (location) {
          const pickup = (r.pickupLocation ?? '').toLowerCase();
          const ret = (r.returnLocation ?? '').toLowerCase();
          if (!pickup.includes(location) && !ret.includes(location)) return false;
        }
        return r.startDate <= to && r.endDate >= from;
      })
      .map((r) => ({
        id: r.id,
        number: r.number,
        plate: r.assignedPlate as string,
        categoryId: r.categoryId,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        contractId: r.contractId,
        clientName: buildClientName(r.clientId),
        pickupLocation: r.pickupLocation,
        returnLocation: r.returnLocation,
      }));

    // Orphan reservations: active, no assignedPlate, overlap period
    const orphanOut = store.reservations
      .filter((r) => {
        if (r.assignedPlate) return false;
        if (r.status === 'CANCELADA') return false;
        return r.startDate <= to && r.endDate >= from;
      })
      .map((r) => {
        const category = store.vehicleCategories.find((c) => c.id === r.categoryId);
        return {
          id: r.id,
          number: r.number,
          categoryId: r.categoryId,
          categoryName: category?.name ?? r.categoryId,
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
          clientName: buildClientName(r.clientId),
          pickupLocation: r.pickupLocation,
          returnLocation: r.returnLocation,
        };
      });

    // Overlap detection: find reservations that start within overlapMinHours of previous on same plate
    const overlapMinHours = (store.settings as { overlapMinHours?: number }).overlapMinHours ?? 2;
    const overlapIds: string[] = [];

    const byPlate: Record<string, typeof reservationOut> = {};
    for (const r of reservationOut) {
      if (!byPlate[r.plate]) byPlate[r.plate] = [];
      byPlate[r.plate].push(r);
    }
    for (const p in byPlate) {
      const sorted = [...byPlate[p]].sort((a, b) => a.startDate.localeCompare(b.startDate));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        // If curr starts on the same day prev ends OR same day → overlap
        // More precise: check hours difference using end/start dates
        const prevEndMs = new Date(prev.endDate + 'T23:59:00').getTime();
        const currStartMs = new Date(curr.startDate + 'T00:00:00').getTime();
        const diffHours = (currStartMs - prevEndMs) / (1000 * 60 * 60);
        if (diffHours < overlapMinHours) {
          overlapIds.push(curr.id);
        }
      }
    }

    // vehicleBlocks pasan tal cual — blockType incluido ('MANUAL' | 'PLATE' | undefined → default MANUAL)
    const blocksOut = (store.vehicleBlocks ?? []).filter((b) => {
      if (!activePlates.has(b.plate)) return false;
      return b.startDate <= to && b.endDate >= from;
    });

    return {
      vehicles: vehicleOut,
      reservations: reservationOut,
      orphans: orphanOut,
      blocks: blocksOut,
      overlapIds,
      overlapMinHours,
      from,
      days,
    };
  });

  return NextResponse.json(data);
}
