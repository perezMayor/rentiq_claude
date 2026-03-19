import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { VehicleModel } from '@/src/lib/types';

// GET /api/vehiculos/modelos
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const url = new URL(req.url);
  const categoryId = url.searchParams.get('categoryId');

  const data = withStore((store) => {
    let list = [...store.vehicleModels];
    if (categoryId) {
      list = list.filter((m) => m.categoryId === categoryId);
    }
    return list;
  });

  return NextResponse.json({ models: data });
}

// POST /api/vehiculos/modelos
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
      entity: 'VehicleModel',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { brand, model, categoryId, transmission, fuel, seats, features, active } =
      body as {
        brand: string;
        model: string;
        categoryId: string;
        transmission: 'MANUAL' | 'AUTOMATICO';
        fuel: 'GASOLINA' | 'DIESEL' | 'ELECTRICO' | 'HIBRIDO';
        seats: number;
        features?: string[];
        active?: boolean;
      };

    if (!brand || !model || !categoryId) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: brand, model, categoryId' },
        { status: 400 }
      );
    }

    const result = withStoreWrite((store) => {
      if (!store.vehicleCategories.find((c) => c.id === categoryId)) {
        throw new Error(`Categoría no encontrada: ${categoryId}`);
      }

      const now = new Date().toISOString();
      const vehicleModel: VehicleModel = {
        id: generateId(),
        brand,
        model,
        categoryId,
        transmission: transmission ?? 'MANUAL',
        fuel: fuel ?? 'GASOLINA',
        seats: seats ?? 5,
        features: features ?? [],
        active: active ?? true,
        createdAt: now,
      };

      store.vehicleModels.push(vehicleModel);
      return vehicleModel;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleModel',
      entityId: result.id,
      details: { action: 'CREATE', brand: result.brand, model: result.model },
    });

    return NextResponse.json({ model: result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[modelos POST] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
