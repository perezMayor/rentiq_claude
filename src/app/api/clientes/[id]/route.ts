import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// ─── GET /api/clientes/[id] ──────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const client = withStore((store) => store.clients.find((c) => c.id === id) ?? null);
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  return NextResponse.json({ client });
}

// ─── PUT /api/clientes/[id] ──────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Client',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json() as Record<string, unknown>;

    // name, if provided, must not be empty
    if ('name' in body && (typeof body.name !== 'string' || !body.name.trim())) {
      return NextResponse.json({ error: 'El campo nombre no puede estar vacío' }, { status: 400 });
    }

    const updated = withStoreWrite((store) => {
      const idx = store.clients.findIndex((c) => c.id === id);
      if (idx === -1) return null;

      const existing = store.clients[idx];

      // type is immutable — strip it from body if present
      const { type: _ignoredType, id: _ignoredId, createdAt: _ignoredCreatedAt, ...rest } = body as {
        type?: unknown;
        id?: unknown;
        createdAt?: unknown;
        [key: string]: unknown;
      };

      const now = new Date().toISOString();

      const merged = {
        ...existing,
        ...(rest as Partial<typeof existing>),
        id: existing.id,
        type: existing.type,         // immutable
        createdAt: existing.createdAt, // immutable
        updatedAt: now,
      };

      store.clients[idx] = merged;
      return merged;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Client',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ client: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE /api/clientes/[id] ───────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'Client',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  // Check for active references
  const hasReservations = withStore(
    (store) => store.reservations.some((r) => r.clientId === id)
  );
  if (hasReservations) {
    return NextResponse.json(
      { error: 'No se puede eliminar un cliente con reservas asociadas' },
      { status: 409 }
    );
  }

  const hasContracts = withStore(
    (store) => store.contracts.some((c) => c.clientId === id)
  );
  if (hasContracts) {
    return NextResponse.json(
      { error: 'No se puede eliminar un cliente con contratos asociados' },
      { status: 409 }
    );
  }

  const deleted = withStoreWrite((store) => {
    const idx = store.clients.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    store.clients.splice(idx, 1);
    return true;
  });

  if (!deleted) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  }

  await appendEvent({
    action: 'SYSTEM',
    actorId: session.userId,
    actorRole: session.role,
    entity: 'Client',
    entityId: id,
    details: { action: 'DELETE' },
  });

  return NextResponse.json({ ok: true });
}
