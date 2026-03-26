import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { Client } from '@/src/lib/types';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const clients = withStore((store) => store.clients);
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'Client', details: { action: 'CREATE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.name?.toString().trim()) {
      return NextResponse.json({ error: 'El campo nombre es obligatorio' }, { status: 400 });
    }
    if (!body.type || !['PARTICULAR', 'EMPRESA', 'COMISIONISTA'].includes(body.type)) {
      return NextResponse.json({ error: 'Tipo de cliente inválido' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const client = withStoreWrite((store) => {
      const c: Client = {
        id: generateId(),
        type: body.type ?? 'PARTICULAR',
        name: body.name,
        surname: body.surname,
        nif: body.nif,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        country: body.country,
        companyName: body.companyName,
        licenseNumber: body.licenseNumber,
        licenseExpiry: body.licenseExpiry,
        commissionPercent: body.commissionPercent,
        preferredLanguage: body.preferredLanguage ?? 'es',
        active: true,
        notes: body.notes,
        createdAt: now,
        updatedAt: now,
      };
      store.clients.push(c);
      return c;
    });
    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'Client', entityId: client.id, details: { action: 'CREATE' } });
    return NextResponse.json({ client }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
