import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { PricingMode, TariffPlan } from '@/src/lib/types';

const VALID_PRICING_MODES: PricingMode[] = ['PRECIO_A', 'PRECIO_B', 'PRECIO_C'];

// GET /api/tarifas
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      details: { action: 'LIST' },
    });
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const plans = withStore((store) => [...store.tariffPlans]);
  return NextResponse.json({ plans });
}

// POST /api/tarifas
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, pricingMode, validFrom, validTo, active } = body as {
      name: string;
      pricingMode: PricingMode;
      validFrom: string;
      validTo: string;
      active?: boolean;
    };

    if (!name || !pricingMode || !validFrom || !validTo) {
      return NextResponse.json(
        { error: 'Faltan campos: name, pricingMode, validFrom, validTo' },
        { status: 400 }
      );
    }
    if (!VALID_PRICING_MODES.includes(pricingMode)) {
      return NextResponse.json({ error: `pricingMode inválido: ${pricingMode}` }, { status: 400 });
    }
    if (validFrom >= validTo) {
      return NextResponse.json({ error: 'validFrom debe ser anterior a validTo' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const plan = withStoreWrite((store) => {
      const newPlan: TariffPlan = {
        id: generateId(),
        name,
        pricingMode,
        validFrom,
        validTo,
        active: active ?? true,
        createdAt: now,
      };
      store.tariffPlans.push(newPlan);
      return newPlan;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'TariffPlan',
      entityId: plan.id,
      details: { action: 'CREATE', name: plan.name },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
