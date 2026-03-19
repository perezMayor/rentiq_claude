import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// GET /api/gestor/sucursales/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const { id } = await params;
  const branch = withStore((store) => store.branches.find((b) => b.id === id) ?? null);
  if (!branch) return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 });
  return NextResponse.json({ branch });
}

// PUT /api/gestor/sucursales/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'CompanyBranch',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, address, phone, email, active } = body as {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      active?: boolean;
    };

    const updated = withStoreWrite((store) => {
      const idx = store.branches.findIndex((b) => b.id === id);
      if (idx === -1) throw Object.assign(new Error('Sucursal no encontrada'), { statusCode: 404 });

      const branch = store.branches[idx];
      if (name) branch.name = name;
      if (address) branch.address = address;
      if (phone) branch.phone = phone;
      if (email) branch.email = email;
      if (active !== undefined) branch.active = active;
      return branch;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'CompanyBranch',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ branch: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json(
      { error: error.message ?? 'Error interno' },
      { status: error.statusCode ?? 500 }
    );
  }
}
