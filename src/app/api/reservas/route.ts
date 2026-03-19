import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, getNextReservationNumber, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { Reservation, ReservationStatus } from '@/src/lib/types';

// GET /api/reservas — list with optional filters
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as ReservationStatus | null;
  const branchId = url.searchParams.get('branchId');
  const clientId = url.searchParams.get('clientId');
  const startFrom = url.searchParams.get('startFrom');
  const startTo = url.searchParams.get('startTo');
  const search = url.searchParams.get('search')?.toLowerCase();

  const data = withStore((store) => {
    let list = [...store.reservations];

    if (status) {
      list = list.filter((r) => r.status === status);
    }
    if (branchId) {
      list = list.filter((r) => r.branchId === branchId);
    }
    if (clientId) {
      list = list.filter((r) => r.clientId === clientId);
    }
    if (startFrom) {
      list = list.filter((r) => r.startDate >= startFrom);
    }
    if (startTo) {
      list = list.filter((r) => r.startDate <= startTo);
    }
    if (search) {
      list = list.filter(
        (r) =>
          r.number.toLowerCase().includes(search) ||
          r.assignedPlate?.toLowerCase().includes(search) ||
          r.notes?.toLowerCase().includes(search)
      );
    }

    // Sort by startDate desc
    list.sort((a, b) => b.startDate.localeCompare(a.startDate));
    return list;
  });

  return NextResponse.json({ reservations: data });
}

// POST /api/reservas — create reservation
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Reservation',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      branchId,
      pickupLocation,
      returnLocation,
      clientId,
      categoryId,
      requestedModelId,
      assignedPlate,
      startDate,
      startTime,
      endDate,
      endTime,
      billedDays,
      tariffPlanId,
      basePrice,
      extrasTotal,
      insuranceTotal,
      fuelCharge,
      penalties,
      discount,
      total,
      extras,
      salesChannelId,
      notes,
    } = body;

    // Validate required fields
    if (!branchId || !clientId || !categoryId || !startDate || !endDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: branchId, clientId, categoryId, startDate, endDate, startTime, endTime' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const result = withStoreWrite((store) => {
      // Validate references exist
      if (!store.branches.find((b) => b.id === branchId)) {
        throw new Error(`Sucursal no encontrada: ${branchId}`);
      }
      if (!store.clients.find((c) => c.id === clientId)) {
        throw new Error(`Cliente no encontrado: ${clientId}`);
      }
      if (!store.vehicleCategories.find((c) => c.id === categoryId)) {
        throw new Error(`Categoría no encontrada: ${categoryId}`);
      }

      const number = getNextReservationNumber(store);
      const reservation: Reservation = {
        id: generateId(),
        number,
        branchId,
        pickupLocation: pickupLocation ?? '',
        returnLocation: returnLocation ?? '',
        clientId,
        categoryId,
        requestedModelId,
        assignedPlate,
        startDate,
        startTime: startTime ?? '09:00',
        endDate,
        endTime: endTime ?? '09:00',
        billedDays: billedDays ?? 1,
        tariffPlanId,
        basePrice: basePrice ?? 0,
        extrasTotal: extrasTotal ?? 0,
        insuranceTotal: insuranceTotal ?? 0,
        fuelCharge: fuelCharge ?? 0,
        penalties: penalties ?? 0,
        discount: discount ?? 0,
        total: total ?? 0,
        extras: extras ?? [],
        salesChannelId,
        status: 'PETICION',
        notes,
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
        auditLog: [
          {
            at: now,
            by: session.userId,
            action: 'CREATE',
            detail: `Reserva creada con número ${number}`,
          },
        ],
      };

      store.reservations.push(reservation);
      return reservation;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Reservation',
      entityId: result.id,
      details: { action: 'CREATE', number: result.number },
    });

    return NextResponse.json({ reservation: result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[reservas POST] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
