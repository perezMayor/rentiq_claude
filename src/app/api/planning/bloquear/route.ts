import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { VehicleBlock } from '@/src/lib/types';

// GET /api/planning/bloquear — list blocks
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const plate = url.searchParams.get('plate')?.toLowerCase();

  const data = withStore((store) => {
    let blocks = store.vehicleBlocks ?? [];
    if (plate) {
      blocks = blocks.filter((b) => b.plate.toLowerCase() === plate);
    }
    return blocks;
  });

  return NextResponse.json({ blocks: data });
}

// POST /api/planning/bloquear — create block
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
      entity: 'VehicleBlock',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  let body: {
    plate?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
    override?: boolean;
    blockType?: 'MANUAL' | 'PLATE';
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { plate, startDate, endDate, reason, override = false, blockType = 'MANUAL' } = body;

  if (!plate || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'plate, startDate y endDate son obligatorios' },
      { status: 400 }
    );
  }

  // Validate date format YYYY-MM-DD
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return NextResponse.json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' }, { status: 400 });
  }

  if (startDate > endDate) {
    return NextResponse.json({ error: 'startDate no puede ser posterior a endDate' }, { status: 400 });
  }

  const result = withStoreWrite((store) => {
    // Validate plate exists in active fleet
    const vehicle = store.vehicles.find((v) => v.plate === plate && v.active);
    if (!vehicle) {
      return { error: `Matrícula no encontrada en la flota activa: ${plate}`, status: 400 };
    }

    if (!store.vehicleBlocks) {
      store.vehicleBlocks = [];
    }

    // Check for conflicts with ABIERTO contracts
    const conflicts = store.contracts.filter((c) => {
      if (c.plate !== plate) return false;
      if (c.status !== 'ABIERTO') return false;
      // Overlap: c.startDate <= endDate AND c.endDate >= startDate
      return c.startDate <= endDate && c.endDate >= startDate;
    });

    if (conflicts.length > 0 && !override) {
      return {
        error: 'Conflicto con contratos abiertos en ese rango',
        status: 409,
        conflicts: conflicts.map((c) => ({
          contractId: c.id,
          contractNumber: c.number,
          startDate: c.startDate,
          endDate: c.endDate,
        })),
      };
    }

    const block: VehicleBlock = {
      id: generateId(),
      plate,
      startDate,
      endDate,
      reason: reason ?? undefined,
      blockType: blockType === 'PLATE' ? 'PLATE' : 'MANUAL',
      createdBy: session.userId,
      createdAt: new Date().toISOString(),
    };

    store.vehicleBlocks.push(block);

    if (override && conflicts.length > 0) {
      return { block, needsOverrideAudit: true };
    }

    return { block, needsOverrideAudit: false };
  });

  if ('error' in result && result.error) {
    if (result.status === 409) {
      return NextResponse.json(
        { error: result.error, conflicts: (result as { conflicts: unknown[] }).conflicts },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.error }, { status: result.status as number });
  }

  const { block, needsOverrideAudit } = result as { block: VehicleBlock; needsOverrideAudit: boolean };

  if (needsOverrideAudit) {
    await appendEvent({
      action: 'OVERRIDE_CONFIRMATION',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleBlock',
      entityId: block.id,
      details: { plate, startDate, endDate, reason: reason ?? '', override: true },
    });
  }

  return NextResponse.json({ block }, { status: 201 });
}
