import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { sendBudgetEmail, type BudgetEmailPayload } from '@/src/lib/services/email-service';

// POST /api/email/presupuesto
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

  try {
    const body = await req.json() as Partial<BudgetEmailPayload>;

    if (!body.clientEmail) {
      return NextResponse.json({ error: 'clientEmail es obligatorio' }, { status: 400 });
    }

    const payload: BudgetEmailPayload = {
      clientName:     body.clientName    ?? '',
      clientEmail:    body.clientEmail,
      language:       body.language      ?? 'es',
      startDate:      body.startDate     ?? '',
      startTime:      body.startTime     ?? '',
      endDate:        body.endDate       ?? '',
      endTime:        body.endTime       ?? '',
      billedDays:     body.billedDays    ?? 1,
      categoryId:     body.categoryId    ?? '',
      basePrice:      body.basePrice     ?? 0,
      discount:       body.discount      ?? 0,
      insuranceTotal: body.insuranceTotal ?? 0,
      extrasTotal:    body.extrasTotal   ?? 0,
      fuelCharge:     body.fuelCharge    ?? 0,
      total:          body.total         ?? 0,
      notes:          body.notes         ?? '',
    };

    const result = await sendBudgetEmail(payload);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Error al enviar' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
