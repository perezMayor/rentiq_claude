import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { PromoCode, DiscountType, PromoScope } from '@/src/lib/types';

// GET /api/promocodes
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const promoCodes = withStore((store) =>
    [...(store.promoCodes ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
  return NextResponse.json({ promoCodes });
}

// POST /api/promocodes
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'PromoCode', details: { action: 'CREATE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json() as {
      code: string;
      description?: string;
      discountType: DiscountType;
      discountValue: number;
      scope?: PromoScope;
      categoryId?: string;
      clientId?: string;
      comisionistaId?: string;
      validFrom?: string;
      validTo?: string;
      maxUses?: number;
      active?: boolean;
    };

    if (!body.code?.trim()) {
      return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 });
    }
    if (!body.discountType || !['PERCENT', 'FIXED'].includes(body.discountType)) {
      return NextResponse.json({ error: 'Tipo de descuento inválido (PERCENT o FIXED)' }, { status: 400 });
    }
    if (typeof body.discountValue !== 'number' || body.discountValue < 0) {
      return NextResponse.json({ error: 'El valor del descuento debe ser un número positivo' }, { status: 400 });
    }

    const result = withStoreWrite((store) => {
      if (!store.promoCodes) store.promoCodes = [];
      const codeUpper = body.code.trim().toUpperCase();
      if (store.promoCodes.find((p) => p.code === codeUpper)) {
        throw new Error(`Ya existe un código promocional con el código ${codeUpper}`);
      }
      const now = new Date().toISOString();
      const promo: PromoCode = {
        id: generateId(),
        code: codeUpper,
        description: body.description?.trim(),
        discountType: body.discountType,
        discountValue: body.discountValue,
        scope: body.scope ?? 'ALL',
        categoryId: body.categoryId,
        clientId: body.clientId,
        comisionistaId: body.comisionistaId,
        validFrom: body.validFrom,
        validTo: body.validTo,
        maxUses: body.maxUses,
        usedCount: 0,
        active: body.active !== false,
        createdAt: now,
        updatedAt: now,
      };
      store.promoCodes.push(promo);
      return promo;
    });

    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'PromoCode', entityId: result.id, details: { action: 'CREATE', code: result.code } });
    return NextResponse.json({ promoCode: result }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
