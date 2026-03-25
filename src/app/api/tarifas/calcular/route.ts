import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';
import { computePriceForDateRange } from '@/src/lib/tariff-calc';

// POST /api/tarifas/calcular
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const { startDate, endDate, totalDays, categoryId } = body as {
      startDate: string;
      endDate: string;
      totalDays: number;
      categoryId: string;
    };

    if (!startDate || !endDate || !categoryId || !totalDays) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const result = withStore((store) => {
      return computePriceForDateRange(
        startDate,
        endDate,
        totalDays,
        categoryId,
        store.tariffPlans,
        store.tariffBrackets,
        store.tariffPrices
      );
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
