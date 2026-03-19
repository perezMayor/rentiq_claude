import { NextRequest, NextResponse } from 'next/server';
import { createSession, SESSION_COOKIE } from '@/src/lib/auth';
import { readStore } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { UserRole } from '@/src/lib/types';

const DEMO_MODE = process.env.RENTIQ_DEMO_MODE === 'true';

const DEMO_ROLE_MAP: Record<string, { userId: string; role: UserRole }> = {
  SUPER_ADMIN: { userId: 'user-superadmin', role: 'SUPER_ADMIN' },
  ADMIN: { userId: 'user-admin', role: 'ADMIN' },
  LECTOR: { userId: 'user-lector', role: 'LECTOR' },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    let userId: string;
    let role: UserRole;

    if (DEMO_MODE) {
      const roleInput = formData.get('role')?.toString().toUpperCase() ?? '';
      const entry = DEMO_ROLE_MAP[roleInput];
      if (!entry) {
        return NextResponse.json({ error: 'Rol inválido en modo demo' }, { status: 400 });
      }
      userId = entry.userId;
      role = entry.role;
    } else {
      const email = formData.get('email')?.toString() ?? '';
      const password = formData.get('password')?.toString() ?? '';

      if (!email || !password) {
        return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
      }

      const store = readStore();
      const user = store.users.find((u) => u.email === email && u.active);
      if (!user) {
        return new NextResponse(null, {
          status: 303,
          headers: { Location: '/login?error=invalid' },
        });
      }

      const bcrypt = await import('bcryptjs');
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return new NextResponse(null, {
          status: 303,
          headers: { Location: '/login?error=invalid' },
        });
      }

      userId = user.id;
      role = user.role;
    }

    const token = createSession(role, userId);

    await appendEvent({
      action: 'AUTH_LOGIN',
      actorId: userId,
      actorRole: role,
      details: { mode: DEMO_MODE ? 'demo' : 'password' },
    });

    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: '/dashboard' },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (err) {
    console.error('[login] error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
