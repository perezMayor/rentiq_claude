import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';
import { buildBlankContractPdf } from '@/src/lib/services/contract-pdf';

// GET /api/contratos/blank?lang=es|en — returns blank contract template PDF
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const lang = req.nextUrl.searchParams.get('lang') ?? 'es';

  const settings = withStore((store) => store.settings);

  try {
    const pdfBuffer = await buildBlankContractPdf(settings, lang);
    const filename = lang === 'en' ? 'blank-contract.pdf' : 'contrato-en-blanco.pdf';

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[contract-pdf] error building blank PDF', err);
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 });
  }
}
