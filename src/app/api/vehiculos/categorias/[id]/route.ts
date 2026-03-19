import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// PUT /api/vehiculos/categorias/[id]
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
      entity: 'VehicleCategory',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { code, name, description, active } = body as {
      code?: string;
      name?: string;
      description?: string;
      active?: boolean;
    };

    const result = withStoreWrite((store) => {
      const idx = store.vehicleCategories.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw new Error(`Categoría no encontrada: ${id}`);
      }

      // Check code uniqueness if changing
      if (code && code.toUpperCase() !== store.vehicleCategories[idx].code) {
        const conflict = store.vehicleCategories.find(
          (c) => c.id !== id && c.code.toUpperCase() === code.toUpperCase()
        );
        if (conflict) {
          throw new Error(`Ya existe una categoría con código: ${code}`);
        }
      }

      const updated = {
        ...store.vehicleCategories[idx],
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(active !== undefined && { active }),
      };

      store.vehicleCategories[idx] = updated;
      return updated;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleCategory',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ category: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[categorias PUT] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/vehiculos/categorias/[id]
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
      entity: 'VehicleCategory',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const result = withStoreWrite((store) => {
      const idx = store.vehicleCategories.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw new Error(`Categoría no encontrada: ${id}`);
      }

      // Guard: no vehicles reference this category
      const hasVehicles = store.vehicles.some((v) => v.categoryId === id);
      if (hasVehicles) {
        const err = new Error(
          'No se puede eliminar: hay vehículos asignados a esta categoría'
        );
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }

      // Guard: no models reference this category
      const hasModels = store.vehicleModels.some((m) => m.categoryId === id);
      if (hasModels) {
        const err = new Error(
          'No se puede eliminar: hay modelos asignados a esta categoría'
        );
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }

      const [removed] = store.vehicleCategories.splice(idx, 1);
      return removed;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleCategory',
      entityId: id,
      details: { action: 'DELETE', code: result.code },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    const statusCode =
      err instanceof Error && (err as Error & { statusCode?: number }).statusCode === 409
        ? 409
        : 500;
    console.error('[categorias DELETE] error:', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
