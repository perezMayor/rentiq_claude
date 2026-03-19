import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// GET /api/vehiculos/flota/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const vehicle = withStore((store) => store.vehicles.find((v) => v.id === id) ?? null);

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ vehicle });
}

// PUT /api/vehiculos/flota/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const {
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
      vin?: string;
      modelId?: string;
      categoryId?: string;
      branchId?: string;
      year?: number;
      color?: string;
      owner?: string;
      currentOdometer?: number;
      active?: boolean;
      activeFrom?: string;
      activeTo?: string;
      notes?: string;
    };

    const result = withStoreWrite((store) => {
      const idx = store.vehicles.findIndex((v) => v.id === id);
      if (idx === -1) {
        throw new Error(`Vehículo no encontrado: ${id}`);
      }

      if (modelId && !store.vehicleModels.find((m) => m.id === modelId)) {
        throw new Error(`Modelo no encontrado: ${modelId}`);
      }
      if (categoryId && !store.vehicleCategories.find((c) => c.id === categoryId)) {
        throw new Error(`Categoría no encontrada: ${categoryId}`);
      }
      if (branchId && !store.branches.find((b) => b.id === branchId)) {
        throw new Error(`Sucursal no encontrada: ${branchId}`);
      }

      const now = new Date().toISOString();
      const updated = {
        ...store.vehicles[idx],
        ...(vin !== undefined && { vin }),
        ...(modelId !== undefined && { modelId }),
        ...(categoryId !== undefined && { categoryId }),
        ...(branchId !== undefined && { branchId }),
        ...(year !== undefined && { year }),
        ...(color !== undefined && { color }),
        ...(owner !== undefined && { owner }),
        ...(currentOdometer !== undefined && { currentOdometer }),
        ...(active !== undefined && { active }),
        ...(activeFrom !== undefined && { activeFrom }),
        ...(activeTo !== undefined && { activeTo }),
        ...(notes !== undefined && { notes }),
        updatedAt: now,
      };

      store.vehicles[idx] = updated;
      return updated;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'FleetVehicle',
      entityId: id,
      details: { action: 'UPDATE', plate: result.plate, active: result.active },
    });

    return NextResponse.json({ vehicle: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[flota PUT] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/vehiculos/flota/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const result = withStoreWrite((store) => {
      const idx = store.vehicles.findIndex((v) => v.id === id);
      if (idx === -1) {
        throw new Error(`Vehículo no encontrado: ${id}`);
      }

      const vehicle = store.vehicles[idx];

      // Guard: active contracts with this plate
      const hasActiveContracts = store.contracts.some(
        (c) => c.plate === vehicle.plate && c.status === 'ABIERTO'
      );
      if (hasActiveContracts) {
        const err = new Error(
          'No se puede eliminar: el vehículo tiene contratos abiertos'
        );
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }

      const [removed] = store.vehicles.splice(idx, 1);
      return removed;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'FleetVehicle',
      entityId: id,
      details: { action: 'DELETE', plate: result.plate },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    const statusCode =
      err instanceof Error && (err as Error & { statusCode?: number }).statusCode === 409
        ? 409
        : 500;
    console.error('[flota DELETE] error:', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
