import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// PUT /api/vehiculos/extras/[id]
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
      entity: 'VehicleExtra',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { code, name, pricingMode, unitPrice, active } = body as {
      code?: string;
      name?: string;
      pricingMode?: 'FIXED' | 'PER_DAY';
      unitPrice?: number;
      active?: boolean;
    };

    if (unitPrice !== undefined && unitPrice < 0) {
      return NextResponse.json(
        { error: 'El precio unitario debe ser >= 0' },
        { status: 400 }
      );
    }

    const result = withStoreWrite((store) => {
      const idx = store.vehicleExtras.findIndex((e) => e.id === id);
      if (idx === -1) {
        throw new Error(`Extra no encontrado: ${id}`);
      }

      if (code && code.toUpperCase() !== store.vehicleExtras[idx].code) {
        const conflict = store.vehicleExtras.find(
          (e) => e.id !== id && e.code.toUpperCase() === code.toUpperCase()
        );
        if (conflict) {
          throw new Error(`Ya existe un extra con código: ${code}`);
        }
      }

      const updated = {
        ...store.vehicleExtras[idx],
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(name !== undefined && { name }),
        ...(pricingMode !== undefined && { pricingMode }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(active !== undefined && { active }),
      };

      store.vehicleExtras[idx] = updated;
      return updated;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleExtra',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ extra: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[extras PUT] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/vehiculos/extras/[id]
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
      entity: 'VehicleExtra',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const result = withStoreWrite((store) => {
      const idx = store.vehicleExtras.findIndex((e) => e.id === id);
      if (idx === -1) {
        throw new Error(`Extra no encontrado: ${id}`);
      }

      const extra = store.vehicleExtras[idx];

      // Guard: no reservations or contracts reference this extra
      const inReservation = store.reservations.some((r) =>
        r.extras.some((re) => re.extraId === id)
      );
      if (inReservation) {
        const err = new Error(
          'No se puede eliminar: el extra está referenciado en reservas existentes'
        );
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }

      const inContract = store.contracts.some((c) =>
        c.extras.some((ce) => ce.extraId === id)
      );
      if (inContract) {
        const err = new Error(
          'No se puede eliminar: el extra está referenciado en contratos existentes'
        );
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }

      const [removed] = store.vehicleExtras.splice(idx, 1);
      return removed;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleExtra',
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
    console.error('[extras DELETE] error:', err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
