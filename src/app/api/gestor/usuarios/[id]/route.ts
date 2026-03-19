import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, isSuperAdmin } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { UserRole } from '@/src/lib/types';

const VALID_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'LECTOR'];

type Params = { params: Promise<{ id: string }> };

// GET /api/gestor/usuarios/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const { id } = await params;
  const user = withStore((store) => {
    const u = store.users.find((u) => u.id === id);
    if (!u) return null;
    const { passwordHash: _, ...safe } = u;
    return safe;
  });

  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  return NextResponse.json({ user });
}

// PUT /api/gestor/usuarios/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'UserAccount',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, email, role, active } = body as {
      name?: string;
      email?: string;
      role?: UserRole;
      active?: boolean;
    };

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Rol inválido: ${role}` }, { status: 400 });
    }
    if (role === 'SUPER_ADMIN' && !isSuperAdmin(session.role)) {
      return NextResponse.json(
        { error: 'Solo SUPER_ADMIN puede asignar rol SUPER_ADMIN' },
        { status: 403 }
      );
    }

    const updated = withStoreWrite((store) => {
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) throw Object.assign(new Error('Usuario no encontrado'), { statusCode: 404 });

      const user = store.users[idx];

      // Cannot modify own role or own active status
      if (id === session.userId && role !== undefined && role !== user.role) {
        throw Object.assign(new Error('No puedes cambiar tu propio rol'), { statusCode: 409 });
      }
      if (id === session.userId && active === false) {
        throw Object.assign(new Error('No puedes desactivar tu propia cuenta'), { statusCode: 409 });
      }

      // Email uniqueness check
      if (email && email.toLowerCase() !== user.email) {
        const exists = store.users.find(
          (u) => u.id !== id && u.email.toLowerCase() === email.toLowerCase()
        );
        if (exists) throw new Error(`Email ya en uso: ${email}`);
      }

      if (name) user.name = name;
      if (email) user.email = email.toLowerCase();
      if (role) user.role = role;
      if (active !== undefined) user.active = active;
      user.updatedAt = new Date().toISOString();

      return user;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'UserAccount',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    const { passwordHash: _, ...safe } = updated;
    return NextResponse.json({ user: safe });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json(
      { error: error.message ?? 'Error interno' },
      { status: error.statusCode ?? 500 }
    );
  }
}

// DELETE /api/gestor/usuarios/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isSuperAdmin(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'UserAccount',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Solo SUPER_ADMIN puede eliminar usuarios' }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.userId) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 409 });
  }

  const deleted = withStoreWrite((store) => {
    const idx = store.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const [removed] = store.users.splice(idx, 1);
    return removed;
  });

  if (!deleted) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  await appendEvent({
    action: 'SYSTEM',
    actorId: session.userId,
    actorRole: session.role,
    entity: 'UserAccount',
    entityId: id,
    details: { action: 'DELETE', email: deleted.email },
  });

  return NextResponse.json({ ok: true });
}
