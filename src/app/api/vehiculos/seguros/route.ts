import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { VehicleInsurance } from '@/src/lib/types';

// GET /api/vehiculos/seguros
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const data = withStore((store) => [...(store.vehicleInsurances ?? [])]);
  return NextResponse.json({ insurances: data });
}

// POST /api/vehiculos/seguros
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
      entity: 'VehicleInsurance',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { code, name, pricingMode, unitPrice, maxDays, active } = body as {
      code: string;
      name: string;
      pricingMode: 'FIXED' | 'PER_DAY';
      unitPrice: number;
      maxDays?: number;
      active?: boolean;
    };

    if (!name) {
      return NextResponse.json({ error: 'Falta campo obligatorio: name' }, { status: 400 });
    }
    if (unitPrice === undefined || unitPrice < 0) {
      return NextResponse.json(
        { error: 'El precio unitario debe ser >= 0' },
        { status: 400 }
      );
    }

    const result = withStoreWrite((store) => {
      if (!store.vehicleInsurances) store.vehicleInsurances = [];
      if (code) {
        const existing = store.vehicleInsurances.find(
          (e) => e.code.toUpperCase() === code.toUpperCase()
        );
        if (existing) {
          throw new Error(`Ya existe un seguro con código: ${code}`);
        }
      }

      const now = new Date().toISOString();
      const insurance: VehicleInsurance = {
        id: generateId(),
        code: code ? code.toUpperCase() : '',
        name,
        pricingMode: pricingMode ?? 'PER_DAY',
        unitPrice,
        ...(maxDays !== undefined && maxDays > 0 && { maxDays }),
        active: active ?? true,
        createdAt: now,
      };

      store.vehicleInsurances.push(insurance);
      return insurance;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleInsurance',
      entityId: result.id,
      details: { action: 'CREATE', code: result.code, name: result.name },
    });

    return NextResponse.json({ insurance: result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
