import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// DELETE /api/planning/bloquear/[id] — remove a vehicle block
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'VehicleBlock',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const { id } = await params;

  const result = withStoreWrite((store) => {
    if (!store.vehicleBlocks) {
      store.vehicleBlocks = [];
    }
    const idx = store.vehicleBlocks.findIndex((b) => b.id === id);
    if (idx === -1) {
      return { error: 'Bloqueo no encontrado', status: 404 };
    }
    store.vehicleBlocks.splice(idx, 1);
    return { ok: true };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status as number });
  }

  return NextResponse.json({ ok: true });
}
