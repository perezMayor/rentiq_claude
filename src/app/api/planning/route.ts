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

  // Compute end date (inclusive) for overlap check
  const fromDate = new Date(from + 'T12:00:00');
  const toDate = new Date(fromDate);
  toDate.setDate(fromDate.getDate() + days - 1);
  const to = toDate.toISOString().split('T')[0];

  const data = withStore((store) => {
    // Filter vehicles
    let vehicles = store.vehicles.filter((v) => v.active);
    if (branchId) {
      vehicles = vehicles.filter((v) => v.branchId === branchId);
    }
    if (categoryId) {
      vehicles = vehicles.filter((v) => v.categoryId === categoryId);
    }
    if (plate) {
      vehicles = vehicles.filter((v) => v.plate.toLowerCase().includes(plate));
    }

    // Build vehicle output
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

    // Filter reservations: must have assignedPlate, overlap period, plate in fleet
    const reservationOut = store.reservations
      .filter((r) => {
        if (!r.assignedPlate) return false;
        if (!activePlates.has(r.assignedPlate)) return false;
        if (r.status === 'CANCELADA') return false;
        // Overlap: startDate <= to AND endDate >= from
        return r.startDate <= to && r.endDate >= from;
      })
      .map((r) => {
        const client = store.clients.find((c) => c.id === r.clientId);
        let clientName = r.clientId;
        if (client) {
          clientName =
            client.type === 'EMPRESA' && client.companyName
              ? client.companyName
              : client.surname
              ? `${client.name} ${client.surname}`
              : client.name;
        }
        return {
          id: r.id,
          number: r.number,
          plate: r.assignedPlate as string,
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
          contractId: r.contractId,
          clientName,
        };
      });

    // Filter blocks: plate in fleet, overlap period
    const blocksOut = (store.vehicleBlocks ?? []).filter((b) => {
      if (!activePlates.has(b.plate)) return false;
      return b.startDate <= to && b.endDate >= from;
    });

    return {
      vehicles: vehicleOut,
      reservations: reservationOut,
      blocks: blocksOut,
      from,
      days,
    };
  });

  return NextResponse.json(data);
}
