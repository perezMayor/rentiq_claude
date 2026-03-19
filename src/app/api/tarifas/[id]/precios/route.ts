import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

type Params = { params: Promise<{ id: string }> };

// PUT /api/tarifas/[id]/precios
// Body: { prices: { bracketId, categoryId, price }[] }
// Upserts all prices for the plan
export async function PUT(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPrice',
      details: { action: 'UPSERT' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id: planId } = await params;

  try {
    const body = await req.json();
    const { prices } = body as {
      prices: { bracketId: string; categoryId: string; price: number }[];
    };

    if (!Array.isArray(prices)) {
      return NextResponse.json({ error: 'prices debe ser un array' }, { status: 400 });
    }

    const updated = withStoreWrite((store) => {
      const plan = store.tariffPlans.find((p) => p.id === planId);
      if (!plan) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });

      for (const { bracketId, categoryId, price } of prices) {
        if (typeof price !== 'number' || price < 0) continue;

        const idx = store.tariffPrices.findIndex(
          (tp) => tp.planId === planId && tp.bracketId === bracketId && tp.categoryId === categoryId
        );

        if (idx !== -1) {
          store.tariffPrices[idx].price = price;
        } else {
          store.tariffPrices.push({
            id: generateId(),
            planId,
            bracketId,
            categoryId,
            price,
          });
        }
      }

      return store.tariffPrices.filter((p) => p.planId === planId);
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPrice',
      details: { action: 'UPSERT', planId, count: prices.length },
    });

    return NextResponse.json({ prices: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: error.statusCode ?? 500 });
  }
}
