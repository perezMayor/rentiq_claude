import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { CompanyBranch, WeeklySchedule } from '@/src/lib/types';

// GET /api/gestor/sucursales
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const branches = withStore((store) => [...store.branches]);
  return NextResponse.json({ branches });
}

// POST /api/gestor/sucursales
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'CompanyBranch',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, address, phone, email, contractPrefix, active } = body as {
      name: string;
      address: string;
      phone: string;
      email: string;
      contractPrefix: string;
      active?: boolean;
    };

    if (!name || !address || !phone || !email || !contractPrefix) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: name, address, phone, email, contractPrefix' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const defaultSchedule: WeeklySchedule = {
      mon: { open: '08:00', close: '20:00' },
      tue: { open: '08:00', close: '20:00' },
      wed: { open: '08:00', close: '20:00' },
      thu: { open: '08:00', close: '20:00' },
      fri: { open: '08:00', close: '20:00' },
      sat: { open: '09:00', close: '14:00' },
      exceptions: [],
    };

    const branch = withStoreWrite((store) => {
      const existing = store.branches.find(
        (b) => b.contractPrefix.toUpperCase() === contractPrefix.toUpperCase()
      );
      if (existing) throw new Error(`Ya existe una sucursal con prefijo: ${contractPrefix}`);

      const newBranch: CompanyBranch = {
        id: generateId(),
        name,
        address,
        phone,
        email,
        active: active ?? true,
        contractPrefix: contractPrefix.toUpperCase(),
        contractCounter: 0,
        invoiceCounter: 0,
        schedule: defaultSchedule,
        createdAt: now,
      };
      store.branches.push(newBranch);
      return newBranch;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'CompanyBranch',
      entityId: branch.id,
      details: { action: 'CREATE', name: branch.name },
    });

    return NextResponse.json({ branch }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
