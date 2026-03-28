import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// PUT /api/vehiculos/seguros/[id]
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
      entity: 'VehicleInsurance',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { code, name, coverageType, franquicia, description, pricingMode, unitPrice, maxDays, applicableGroupIds, active } = body as {
      code?: string;
      name?: string;
      coverageType?: 'BASICO' | 'TERCEROS' | 'TODO_RIESGO_CON' | 'TODO_RIESGO_SIN' | 'OTRO';
      franquicia?: number | null;
      description?: string;
      pricingMode?: 'FIXED' | 'PER_DAY';
      unitPrice?: number;
      maxDays?: number | null;
      applicableGroupIds?: string[];
      active?: boolean;
    };

    const result = withStoreWrite((store) => {
      if (!store.vehicleInsurances) store.vehicleInsurances = [];
      const idx = store.vehicleInsurances.findIndex((e) => e.id === id);
      if (idx === -1) {
        throw new Error(`Seguro no encontrado: ${id}`);
      }

      if (code && code.toUpperCase() !== store.vehicleInsurances[idx].code) {
        const conflict = store.vehicleInsurances.find(
          (e) => e.id !== id && e.code.toUpperCase() === code.toUpperCase()
        );
        if (conflict) {
          throw new Error(`Ya existe un seguro con código: ${code}`);
        }
      }

      const updated = {
        ...store.vehicleInsurances[idx],
        ...(code !== undefined && { code: code.toUpperCase() }),
        ...(name !== undefined && { name }),
        ...(coverageType !== undefined && { coverageType }),
        ...(franquicia !== undefined && { franquicia: franquicia === null ? undefined : franquicia }),
        ...(description !== undefined && { description }),
        ...(pricingMode !== undefined && { pricingMode }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(maxDays !== undefined && { maxDays: maxDays === null ? undefined : maxDays }),
        ...(applicableGroupIds !== undefined && { applicableGroupIds }),
        ...(active !== undefined && { active }),
      };

      store.vehicleInsurances[idx] = updated;
      return updated;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleInsurance',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ insurance: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/vehiculos/seguros/[id]
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
      entity: 'VehicleInsurance',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const result = withStoreWrite((store) => {
      if (!store.vehicleInsurances) store.vehicleInsurances = [];
      const idx = store.vehicleInsurances.findIndex((e) => e.id === id);
      if (idx === -1) {
        throw new Error(`Seguro no encontrado: ${id}`);
      }
      const [removed] = store.vehicleInsurances.splice(idx, 1);
      return removed;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleInsurance',
      entityId: id,
      details: { action: 'DELETE', code: result.code },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
