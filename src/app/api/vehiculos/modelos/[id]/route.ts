import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// PUT /api/vehiculos/modelos/[id]
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
      entity: 'VehicleModel',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { brand, model, categoryId, transmission, fuel, seats, doors, year, features, active } =
      body as {
        brand?: string;
        model?: string;
        categoryId?: string;
        transmission?: 'MANUAL' | 'AUTOMATICO';
        fuel?: 'GASOLINA' | 'DIESEL' | 'ELECTRICO' | 'HIBRIDO';
        seats?: number;
        doors?: number;
        year?: number;
        features?: string[];
        active?: boolean;
      };

    const result = withStoreWrite((store) => {
      const idx = store.vehicleModels.findIndex((m) => m.id === id);
      if (idx === -1) {
        throw new Error(`Modelo no encontrado: ${id}`);
      }

      if (categoryId && !store.vehicleCategories.find((c) => c.id === categoryId)) {
        throw new Error(`Categoría no encontrada: ${categoryId}`);
      }

      const updated = {
        ...store.vehicleModels[idx],
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(categoryId !== undefined && { categoryId }),
        ...(transmission !== undefined && { transmission }),
        ...(fuel !== undefined && { fuel }),
        ...(seats !== undefined && { seats }),
        ...(doors !== undefined && { doors }),
        ...(year !== undefined && { year }),
        ...(features !== undefined && { features }),
        ...(active !== undefined && { active }),
      };

      store.vehicleModels[idx] = updated;
      return updated;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleModel',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ model: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[modelos PUT] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/vehiculos/modelos/[id]
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
      entity: 'VehicleModel',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const result = withStoreWrite((store) => {
      const idx = store.vehicleModels.findIndex((m) => m.id === id);
      if (idx === -1) {
        throw new Error(`Modelo no encontrado: ${id}`);
      }

      // Guard: no vehicles reference this model
      const hasVehicles = store.vehicles.some((v) => v.modelId === id);
      if (hasVehicles) {
        const err = new Error(
          'No se puede eliminar: hay vehículos asignados a este modelo'
        );
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }

      const [removed] = store.vehicleModels.splice(idx, 1);
      return removed;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleModel',
      entityId: id,
      details: { action: 'DELETE', brand: result.brand, model: result.model },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    const statusCode =
      err instanceof Error && (err as Error & { statusCode?: number }).statusCode === 409
        ? 409
        : 500;
    console.error('[modelos DELETE] error:', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
