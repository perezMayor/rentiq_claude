import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { TariffBracket } from '@/src/lib/types';

type Params = { params: Promise<{ id: string }> };

// POST /api/tarifas/[id]/tramos
export async function POST(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffBracket',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const body = await req.json();
    const { label, minDays, maxDays, isExtraDay } = body as {
      label: string;
      minDays?: number;
      maxDays?: number | null;
      isExtraDay?: boolean;
    };

    if (!label) {
      return NextResponse.json({ error: 'Falta el campo: label' }, { status: 400 });
    }
    if (!isExtraDay && (typeof minDays !== 'number' || minDays < 1)) {
      return NextResponse.json(
        { error: 'Faltan campos: label, minDays (>=1)' },
        { status: 400 }
      );
    }

    const bracket = withStoreWrite((store) => {
      const plan = store.tariffPlans.find((p) => p.id === planId);
      if (!plan) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });

      if (isExtraDay) {
        const already = store.tariffBrackets.find((b) => b.planId === planId && b.isExtraDay);
        if (already) throw Object.assign(new Error('Ya existe un tramo de día extra para este plan'), { statusCode: 400 });
      }

      const existing = store.tariffBrackets.filter((b) => b.planId === planId);
      const order = existing.length + 1;

      const newBracket: TariffBracket = {
        id: generateId(),
        planId,
        label,
        minDays: isExtraDay ? 0 : (minDays ?? 1),
        maxDays: isExtraDay ? null : (maxDays ?? null),
        order,
        isExtraDay: isExtraDay ?? false,
      };
      store.tariffBrackets.push(newBracket);
      return newBracket;
    });

    return NextResponse.json({ bracket }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: error.statusCode ?? 500 });
  }
}
