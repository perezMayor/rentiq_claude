import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { VehicleCategory } from '@/src/lib/types';

// GET /api/vehiculos/categorias
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const data = withStore((store) => [...store.vehicleCategories]);
  return NextResponse.json({ categories: data });
}

// POST /api/vehiculos/categorias
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
      entity: 'VehicleCategory',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { code, name, description, active } = body as {
      code: string;
      name: string;
      description?: string;
      active?: boolean;
    };

    if (!code || !name) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: code, name' },
        { status: 400 }
      );
    }

    const result = withStoreWrite((store) => {
      const existing = store.vehicleCategories.find(
        (c) => c.code.toUpperCase() === code.toUpperCase()
      );
      if (existing) {
        throw new Error(`Ya existe una categoría con código: ${code}`);
      }

      const now = new Date().toISOString();
      const category: VehicleCategory = {
        id: generateId(),
        code: code.toUpperCase(),
        name,
        description,
        active: active ?? true,
        createdAt: now,
      };

      store.vehicleCategories.push(category);
      return category;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleCategory',
      entityId: result.id,
      details: { action: 'CREATE', code: result.code, name: result.name },
    });

    return NextResponse.json({ category: result }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[categorias POST] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
