import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';
import { renderTemplateWithMacros } from '@/src/lib/services/template-renderer';

type Params = { params: Promise<{ id: string }> };

function fmt(d: string, lang: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return lang === 'en' ? `${m}/${day}/${y}` : `${day}/${m}/${y}`;
}

function fmtAmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// GET /api/facturas/[id]/print — returns rendered invoice HTML for printing
export async function GET(req: NextRequest, { params }: Params) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  const result = withStore((store) => {
    const invoice = store.invoices.find((i) => i.id === id);
    if (!invoice) return null;
    const client = store.clients.find((c) => c.id === invoice.clientId);
    const contract = store.contracts.find((c) => c.id === invoice.contractId);
    const branch = store.branches.find((b) => b.id === invoice.branchId);
    const settings = store.settings;
    const language = client?.preferredLanguage ?? 'es';
    const templateCode = language === 'en' ? 'FAC_BASE_EN' : 'FAC_BASE_ES';
    const template = store.templates.find((t) => t.templateCode === templateCode && t.active);
    return { invoice, client, contract, branch, settings, template, language };
  });

  if (!result) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

  const { invoice, client, contract, branch, settings, template, language } = result;

  if (!template) {
    // Fallback: simple HTML if no template configured
    const html = buildFallbackHtml(invoice, client, contract, branch, settings, language);
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const baseImponible =
    invoice.baseAmount +
    invoice.extrasAmount +
    invoice.insuranceAmount +
    invoice.fuelAmount +
    invoice.penalties -
    invoice.discount;

  const clientName = client
    ? `${client.name}${client.surname ? ' ' + client.surname : ''}`
    : invoice.clientId;

  const macros: Record<string, string> = {
    company_name: settings.documentName ?? settings.name ?? '',
    company_tax_id: settings.taxId ?? settings.nif ?? '',
    company_fiscal_address: settings.fiscalAddress ?? settings.address ?? '',
    company_phone: settings.companyPhone ?? settings.phone ?? '',
    company_email_from: settings.companyEmailFrom ?? settings.email ?? '',
    company_website: settings.companyWebsite ?? '',
    company_document_footer: settings.documentFooter ?? '',
    company_logo_data_url: settings.logoDataUrl ?? '',
    invoice_number: invoice.number,
    invoice_date: fmt(invoice.date, language),
    invoice_type: invoice.type,
    contract_number: contract?.number ?? invoice.contractId,
    branch_name: branch?.name ?? invoice.branchId,
    customer_name: clientName,
    customer_tax_id: client?.nif ?? '',
    customer_email: client?.email ?? '',
    customer_phone: client?.phone ?? '',
    base_amount: fmtAmt(invoice.baseAmount),
    extras_amount: fmtAmt(invoice.extrasAmount),
    insurance_amount: fmtAmt(invoice.insuranceAmount),
    fuel_amount: fmtAmt(invoice.fuelAmount),
    penalties: fmtAmt(invoice.penalties),
    discount_amount: fmtAmt(invoice.discount),
    base_imponible: fmtAmt(baseImponible),
    iva_percent: String(invoice.ivaPercent),
    iva_amount: fmtAmt(invoice.ivaAmount),
    total: fmtAmt(invoice.total),
    billed_days: String(contract?.billedDays ?? ''),
    // Contract period & plate for occupation concept
    delivery_date: contract ? fmt(contract.startDate, language) : '',
    delivery_time: contract?.startTime ?? '',
    pickup_date: contract ? fmt(contract.endDate, language) : '',
    pickup_time: contract?.endTime ?? '',
    assigned_plate: contract?.plate ?? '',
  };

  const html = renderTemplateWithMacros(template.htmlContent, macros);
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildFallbackHtml(
  invoice: { number: string; date: string; type: string; baseAmount: number; extrasAmount: number; insuranceAmount: number; fuelAmount: number; penalties: number; discount: number; ivaPercent: number; ivaAmount: number; total: number },
  client: { name: string; surname?: string; nif?: string; email?: string } | undefined,
  contract: { number?: string; billedDays?: number } | undefined,
  branch: { name?: string } | undefined,
  settings: { name?: string; nif?: string; address?: string; phone?: string; documentName?: string; taxId?: string; fiscalAddress?: string; companyPhone?: string; documentFooter?: string; logoDataUrl?: string },
  language: string,
): string {
  const fmt2 = (d: string) => fmt(d, language);
  const clientName = client ? `${client.name}${client.surname ? ' ' + client.surname : ''}` : '—';
  const baseImponible = invoice.baseAmount + invoice.extrasAmount + invoice.insuranceAmount + invoice.fuelAmount + invoice.penalties - invoice.discount;

  return `<!DOCTYPE html><html lang="${language}"><head><meta charset="UTF-8">
<title>${language === 'en' ? 'Invoice' : 'Factura'} ${invoice.number}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; margin: 40px; color: #222; }
  h1 { font-size: 1.3rem; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td, th { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  .total-row td { font-weight: 700; font-size: 1.05rem; border-top: 2px solid #2b6cbd; }
  .footer { margin-top: 40px; font-size: 0.8rem; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<h1>${language === 'en' ? 'INVOICE' : 'FACTURA'} ${invoice.number}</h1>
<p>${language === 'en' ? 'Date' : 'Fecha'}: ${fmt2(invoice.date)} | ${language === 'en' ? 'Contract' : 'Contrato'}: ${contract?.number ?? '—'} | ${branch?.name ?? ''}</p>
<p><strong>${settings.documentName ?? settings.name ?? ''}</strong> — ${settings.taxId ?? settings.nif ?? ''}<br/>
${settings.fiscalAddress ?? settings.address ?? ''} | ${settings.companyPhone ?? settings.phone ?? ''}</p>
<hr/>
<p><strong>${language === 'en' ? 'Client' : 'Cliente'}:</strong> ${clientName} — ${client?.nif ?? ''}</p>
<table>
  <tbody>
    ${invoice.baseAmount > 0 ? `<tr><td>${language === 'en' ? 'Base rental' : 'Alquiler base'} (${contract?.billedDays ?? '?'} ${language === 'en' ? 'days' : 'días'})</td><td>${fmtAmt(invoice.baseAmount)} €</td></tr>` : ''}
    ${invoice.extrasAmount > 0 ? `<tr><td>${language === 'en' ? 'Extras' : 'Extras'}</td><td>${fmtAmt(invoice.extrasAmount)} €</td></tr>` : ''}
    ${invoice.insuranceAmount > 0 ? `<tr><td>${language === 'en' ? 'Insurance' : 'Seguros'}</td><td>${fmtAmt(invoice.insuranceAmount)} €</td></tr>` : ''}
    ${invoice.fuelAmount > 0 ? `<tr><td>${language === 'en' ? 'Fuel' : 'Combustible'}</td><td>${fmtAmt(invoice.fuelAmount)} €</td></tr>` : ''}
    ${invoice.penalties > 0 ? `<tr><td>${language === 'en' ? 'Penalties' : 'Penalizaciones'}</td><td>${fmtAmt(invoice.penalties)} €</td></tr>` : ''}
    ${invoice.discount > 0 ? `<tr><td>${language === 'en' ? 'Discount' : 'Descuento'}</td><td>− ${fmtAmt(invoice.discount)} €</td></tr>` : ''}
    <tr><td><strong>${language === 'en' ? 'Taxable base' : 'Base imponible'}</strong></td><td><strong>${fmtAmt(baseImponible)} €</strong></td></tr>
    <tr><td>${language === 'en' ? 'VAT' : 'IVA'} (${invoice.ivaPercent}%)</td><td>${fmtAmt(invoice.ivaAmount)} €</td></tr>
    <tr class="total-row"><td>TOTAL</td><td>${fmtAmt(invoice.total)} €</td></tr>
  </tbody>
</table>
${settings.documentFooter ? `<div class="footer">${settings.documentFooter}</div>` : ''}
<script>window.onload = () => window.print();</script>
</body></html>`;
}
