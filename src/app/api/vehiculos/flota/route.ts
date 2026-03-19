import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { FleetVehicle } from '@/src/lib/types';

// GET /api/vehiculos/flota
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const activeParam = url.searchParams.get('active');
  const branchId = url.searchParams.get('branchId');
  const categoryId = url.searchParams.get('categoryId');
  const search = url.searchParams.get('search')?.toLowerCase();

  const data = withStore((store) => {
    let list = [...store.vehicles];

    if (activeParam !== null) {
      const onlyActive = activeParam === 'true';
      list = list.filter((v) => v.active === onlyActive);
    }
    if (branchId) {
      list = list.filter((v) => v.branchId === branchId);
    }
    if (categoryId) {
      list = list.filter((v) => v.categoryId === categoryId);
    }
    if (search) {
      list = list.filter((v) => v.plate.toLowerCase().includes(search));
    }

    list.sort((a, b) => a.plate.localeCompare(b.plate));
    return list;
  });

  return NextResponse.json({ vehicles: data });
}

// POST /api/vehiculos/flota
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
      entity: 'FleetVehicle',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      plate,
      vin,
      modelId,
      categoryId,
      branchId,
      year,
      color,
      owner,
      currentOdometer,
      active,
      activeFrom,
      activeTo,
      notes,
    } = body as {
      plate: string;
      vin?: string;
      modelId: string;
      categoryId: string;
      branchId: string;
      year: number;
      color?: string;
      owner: string;
      currentOdometer: number;
      active?: boolean;
      activeFrom: string;
      activeTo?: string;
      notes?: string;
    };

    if (!plate || !modelId || !categoryId || !branchId || year === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: plate, modelId, categoryId, branchId, year' },
        { status: 400 }
      );
    }

    if (typeof year !== 'number' || isNaN(year)) {
      return NextResponse.json({ error: 'El año debe ser un número' }, { status: 400 });
    }

    const result = withStoreWrite((store) => {
      // Plate uniqueness
      const plateConflict = store.vehicles.find(
        (v) => v.plate.toUpperCase() === plate.toUpperCase()
      );
      if (plateConflict) {
        throw new Error(`Ya existe un vehículo con matrícula: ${plate}`);
      }

      if (!store.vehicleModels.find((m) => m.id === modelId)) {
        throw new Error(`Modelo no encontrado: ${modelId}`);
      }
      if (!store.vehicleCategories.find((c) => c.id === categoryId)) {
        throw new Error(`Categoría no encontrada: ${categoryId}`);
      }
      if (!store.branches.find((b) => b.id === branchId)) {
        throw new Error(`Sucursal no encontrada: ${branchId}`);
      }

      const now = new Date().toISOString();
      const vehicle: FleetVehicle = {
        id: generateId(),
        plate: plate.toUpperCase(),
        vin,
        modelId,
        categoryId,
        branchId,
        year,
        color,
        owner: owner ?? 'PROPIO',
        currentOdometer: currentOdometer ?? 0,
        active: active ?? true,
        activeFrom: activeFrom ?? now.slice(0, 10),
        activeTo,
        notes,
        createdAt: now,
        updatedAt: now,
      };

      store.vehicles.push(vehicle);
      return vehicle;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'FleetVehicle',
      entityId: result.id,
      details: { action: 'CREATE', plate: result.plate },
    });

    return NextResponse.json({ vehicle: result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[flota POST] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
