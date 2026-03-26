import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { sendInvoiceEmail } from '@/src/lib/services/email-service';

type Params = { params: Promise<{ id: string }> };

// POST /api/email/factura/[id]
export async function POST(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({})) as { to?: string };
    const result = await sendInvoiceEmail(id, body.to);

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Error al enviar' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
