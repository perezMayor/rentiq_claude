import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';
import { buildContractPdf, type ContractPdfData } from '@/src/lib/services/contract-pdf';

type Params = { params: Promise<{ id: string }> };

// GET /api/contratos/[id]/print — returns contract PDF (2 copies × anverso + reverso)
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  const data = withStore((store): ContractPdfData | null => {
    const contract = store.contracts.find((c) => c.id === id);
    if (!contract) return null;

    const client   = store.clients.find((c) => c.id === contract.clientId) ?? null;
    const vehicle  = store.vehicles.find((v) => v.plate === contract.plate) ?? null;
    const model    = vehicle ? (store.vehicleModels.find((m) => m.id === vehicle.modelId) ?? null) : null;
    const category = store.vehicleCategories.find((c) => c.id === contract.categoryId) ?? null;
    const branch   = store.branches.find((b) => b.id === contract.branchId) ?? null;
    const settings = store.settings;
    const language = client?.preferredLanguage ?? 'es';

    return { contract, client, vehicle, model, category, branch, settings, language };
  });

  if (!data) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });

  try {
    const pdfBuffer = await buildContractPdf(data);
    const filename = `contrato-${data.contract.number ?? id}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('[contract-pdf] error building PDF', err);
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 });
  }
}
