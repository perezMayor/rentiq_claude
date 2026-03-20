import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId, getNextContractNumber } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { Contract, ContractStatus } from '@/src/lib/types';

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

// POST /api/contratos — direct contract creation (without reservation)
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'Contract', details: { action: 'CREATE_DIRECT' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const body = await req.json();
  const {
    branchId, clientId, plate, categoryId,
    pickupLocation = '', returnLocation = '',
    startDate, startTime = '09:00', endDate, endTime = '09:00',
    billedDays = 1,
    basePrice = 0, extrasTotal = 0, insuranceTotal = 0,
    fuelCharge = 0, penalties = 0, discount = 0, total = 0,
    notes,
  } = body;

  if (!branchId || !clientId || !plate || !categoryId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Faltan campos obligatorios: sucursal, cliente, matrícula, categoría, fechas' }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    const result = withStoreWrite((store) => {
      // Validate entities exist
      if (!store.branches.find((b) => b.id === branchId)) throw Object.assign(new Error('Sucursal no encontrada'), { statusCode: 404 });
      if (!store.clients.find((c) => c.id === clientId)) throw Object.assign(new Error('Cliente no encontrado'), { statusCode: 404 });

      // Check plate availability
      const conflict = store.contracts.find(
        (c) => c.plate === plate && c.status === 'ABIERTO' && c.startDate <= endDate && c.endDate >= startDate
      );
      if (conflict) throw Object.assign(new Error(`Matrícula ${plate} ya asignada al contrato ${conflict.number} en ese período`), { statusCode: 409 });

      const contractNumber = getNextContractNumber(store, branchId);
      const contractId = generateId();

      const contract: Contract = {
        id: contractId,
        number: contractNumber,
        branchId,
        clientId,
        plate: plate.toUpperCase(),
        categoryId,
        pickupLocation,
        returnLocation,
        startDate,
        startTime,
        endDate,
        endTime,
        billedDays: Number(billedDays),
        basePrice: Number(basePrice),
        extrasTotal: Number(extrasTotal),
        insuranceTotal: Number(insuranceTotal),
        fuelCharge: Number(fuelCharge),
        penalties: Number(penalties),
        discount: Number(discount),
        total: Number(total),
        extras: [],
        status: 'ABIERTO',
        payments: [],
        internalExpenseIds: [],
        notes: notes || undefined,
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
        auditLog: [{ at: now, by: session.userId, action: 'CREATE', detail: 'Contrato creado directamente (sin reserva)' }],
      };

      store.contracts.push(contract);
      return contract;
    });

    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'Contract', entityId: result.id, details: { action: 'CREATE_DIRECT', number: result.number } });

    return NextResponse.json({ contract: result }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: error.statusCode ?? 500 });
  }
}
