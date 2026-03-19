import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, isSuperAdmin } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { UserRole } from '@/src/lib/types';

const VALID_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'LECTOR'];

// GET /api/gestor/usuarios
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!isAdminOrAbove(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'UserAccount',
      details: { action: 'LIST' },
    });
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const users = withStore((store) =>
    store.users.map(({ passwordHash: _, ...u }) => u)
  );

  return NextResponse.json({ users });
}

// POST /api/gestor/usuarios
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!isAdminOrAbove(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'UserAccount',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, role, active } = body as {
      name: string;
      email: string;
      role: UserRole;
      active?: boolean;
    };

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: name, email, role' },
        { status: 400 }
      );
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Rol inválido: ${role}` }, { status: 400 });
    }
    // Only SUPER_ADMIN can create SUPER_ADMIN users
    if (role === 'SUPER_ADMIN' && !isSuperAdmin(session.role)) {
      return NextResponse.json(
        { error: 'Solo SUPER_ADMIN puede crear usuarios con rol SUPER_ADMIN' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const user = withStoreWrite((store) => {
      const existing = store.users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );
      if (existing) {
        throw new Error(`Ya existe un usuario con email: ${email}`);
      }

      const newUser = {
        id: generateId(),
        name,
        email: email.toLowerCase(),
        role,
        passwordHash: '',
        active: active ?? true,
        createdAt: now,
        updatedAt: now,
      };
      store.users.push(newUser);
      return newUser;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'UserAccount',
      entityId: user.id,
      details: { action: 'CREATE', email: user.email, role: user.role },
    });

    const { passwordHash: _, ...safeUser } = user;
    return NextResponse.json({ user: safeUser }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[usuarios POST] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
