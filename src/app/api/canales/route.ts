import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { SalesChannel } from '@/src/lib/types';

// GET /api/canales
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const channels = withStore((store) => [...store.salesChannels]);
  return NextResponse.json({ channels });
}

// POST /api/canales
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'SalesChannel', details: { action: 'CREATE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, code, commissionPercent } = body as { name: string; code: string; commissionPercent: number };

    if (!name?.trim() || !code?.trim()) {
      return NextResponse.json({ error: 'Nombre y código son obligatorios' }, { status: 400 });
    }

    const result = withStoreWrite((store) => {
      const codeUpper = code.trim().toUpperCase();
      if (store.salesChannels.find((c) => c.code === codeUpper)) {
        throw new Error(`Ya existe un canal con el código ${codeUpper}`);
      }
      const channel: SalesChannel = {
        id: generateId(),
        name: name.trim(),
        code: codeUpper,
        commissionPercent: typeof commissionPercent === 'number' ? commissionPercent : 0,
        active: true,
        createdAt: new Date().toISOString(),
      };
      store.salesChannels.push(channel);
      return channel;
    });

    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'SalesChannel', entityId: result.id, details: { action: 'CREATE', code: result.code } });
    return NextResponse.json({ channel: result }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
