import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite, generateId, getNextContractNumber } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { Contract } from '@/src/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/reservas/[id]/convertir — convert a CONFIRMADA reservation to contract
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
      details: { action: 'CONVERTIR' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;
  const now = new Date().toISOString();

  try {
    const result = withStoreWrite((store) => {
      const resIdx = store.reservations.findIndex((r) => r.id === id);
      if (resIdx === -1) {
        throw Object.assign(new Error('Reserva no encontrada'), { statusCode: 404 });
      }

      const reservation = store.reservations[resIdx];

      if (reservation.status !== 'CONFIRMADA') {
        throw Object.assign(
          new Error(`Solo se pueden convertir reservas CONFIRMADAS. Estado actual: ${reservation.status}`),
          { statusCode: 409 }
        );
      }

      if (!reservation.assignedPlate) {
        throw Object.assign(
          new Error('La reserva no tiene matrícula asignada. Asigna una matrícula antes de convertir.'),
          { statusCode: 409 }
        );
      }

      if (reservation.contractId) {
        throw Object.assign(
          new Error('Esta reserva ya tiene un contrato asociado'),
          { statusCode: 409 }
        );
      }

      // Check plate availability: no ABIERTO contract with same plate and overlapping dates
      const plateConflict = store.contracts.find(
        (c) =>
          c.plate === reservation.assignedPlate &&
          c.status === 'ABIERTO' &&
          c.startDate <= reservation.endDate &&
          c.endDate >= reservation.startDate
      );
      if (plateConflict) {
        throw Object.assign(
          new Error(
            `La matrícula ${reservation.assignedPlate} ya está asignada al contrato ${plateConflict.number} en ese período`
          ),
          { statusCode: 409 }
        );
      }

      const contractNumber = getNextContractNumber(store, reservation.branchId);
      const contractId = generateId();

      const contract: Contract = {
        id: contractId,
        number: contractNumber,
        branchId: reservation.branchId,
        reservationId: reservation.id,
        clientId: reservation.clientId,
        plate: reservation.assignedPlate,
        categoryId: reservation.categoryId,
        pickupLocation: reservation.pickupLocation,
        returnLocation: reservation.returnLocation,
        startDate: reservation.startDate,
        startTime: reservation.startTime,
        endDate: reservation.endDate,
        endTime: reservation.endTime,
        billedDays: reservation.billedDays,
        basePrice: reservation.basePrice,
        extrasTotal: reservation.extrasTotal,
        insuranceTotal: reservation.insuranceTotal,
        fuelCharge: reservation.fuelCharge,
        penalties: reservation.penalties,
        discount: reservation.discount,
        total: reservation.total,
        extras: reservation.extras,
        status: 'ABIERTO',
        payments: [],
        internalExpenseIds: [],
        notes: reservation.notes,
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
        auditLog: [
          {
            at: now,
            by: session.userId,
            action: 'CREATE',
            detail: `Contrato creado desde reserva ${reservation.number}`,
          },
        ],
      };

      store.contracts.push(contract);

      // Bidirectional link
      store.reservations[resIdx] = {
        ...reservation,
        contractId: contractId,
        updatedAt: now,
        auditLog: [
          ...reservation.auditLog,
          {
            at: now,
            by: session.userId,
            action: 'CONVERTIR',
            detail: `Convertida a contrato ${contractNumber}`,
          },
        ],
      };

      return contract;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Contract',
      entityId: result.id,
      details: { action: 'CREATE', number: result.number, reservationId: id },
    });

    return NextResponse.json({ contract: result }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    const message = error.message ?? 'Error interno';
    const status = error.statusCode ?? 500;
    console.error('[convertir POST] error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
