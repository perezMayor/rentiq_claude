import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStoreWrite, generateId } from '@/src/lib/store';
import type { TariffCellType } from '@/src/lib/types';
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
      prices: {
        bracketId: string;
        categoryId: string;
        pricingType: TariffCellType;
        price: number;
        priceKm?: number;
        kmIncluidos?: number;
      }[];
    };

    if (!Array.isArray(prices)) {
      return NextResponse.json({ error: 'prices debe ser un array' }, { status: 400 });
    }

    const updated = withStoreWrite((store) => {
      const plan = store.tariffPlans.find((p) => p.id === planId);
      if (!plan) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });

      for (const { bracketId, categoryId, pricingType, price, priceKm, kmIncluidos } of prices) {
        const idx = store.tariffPrices.findIndex(
          (tp) => tp.planId === planId && tp.bracketId === bracketId && tp.categoryId === categoryId
        );

        const entry = {
          id: idx !== -1 ? store.tariffPrices[idx].id : generateId(),
          planId,
          bracketId,
          categoryId,
          pricingType: pricingType ?? 'DIA',
          price: typeof price === 'number' ? price : 0,
          priceKm: priceKm ?? undefined,
          kmIncluidos: kmIncluidos ?? undefined,
        };

        if (idx !== -1) {
          store.tariffPrices[idx] = entry;
        } else {
          store.tariffPrices.push(entry);
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
