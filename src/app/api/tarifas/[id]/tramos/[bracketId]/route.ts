import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string; bracketId: string }> };

// PUT /api/tarifas/[id]/tramos/[bracketId]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { bracketId } = await params;

  try {
    const body = await req.json();
    const { label, minDays, maxDays } = body as {
      label?: string;
      minDays?: number;
      maxDays?: number | null;
    };

    const updated = withStoreWrite((store) => {
      const idx = store.tariffBrackets.findIndex((b) => b.id === bracketId);
      if (idx === -1) throw Object.assign(new Error('Tramo no encontrado'), { statusCode: 404 });
      const b = store.tariffBrackets[idx];
      if (label) b.label = label;
      if (typeof minDays === 'number') b.minDays = minDays;
      if (maxDays !== undefined) b.maxDays = maxDays;
      return b;
    });

    return NextResponse.json({ bracket: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: error.statusCode ?? 500 });
  }
}

// DELETE /api/tarifas/[id]/tramos/[bracketId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffBracket',
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id: planId, bracketId } = await params;

  withStoreWrite((store) => {
    const idx = store.tariffBrackets.findIndex((b) => b.id === bracketId);
    if (idx === -1) return;
    store.tariffBrackets.splice(idx, 1);
    // Remove prices for this bracket
    store.tariffPrices = store.tariffPrices.filter(
      (p) => !(p.planId === planId && p.bracketId === bracketId)
    );
    // Re-number order
    store.tariffBrackets
      .filter((b) => b.planId === planId)
      .sort((a, b) => a.order - b.order)
      .forEach((b, i) => { b.order = i + 1; });
  });

  return NextResponse.json({ ok: true });
}
