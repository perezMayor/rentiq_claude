import 'server-only';
import { withStore } from '../store';
import { renderTemplateWithMacros } from './template-renderer';
import { sendEmail } from '../email';

function fmt(d: string, lang: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return lang === 'en' ? `${m}/${day}/${y}` : `${day}/${m}/${y}`;
}

function fmtAmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Reservation confirmation ─────────────────────────────────────────────────

export async function sendReservationConfirmationEmail(
  reservationId: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = withStore((store) => {
    const reservation = store.reservations.find((r) => r.id === reservationId);
    if (!reservation) return null;
    const client = store.clients.find((c) => c.id === reservation.clientId);
    const category = store.vehicleCategories.find((c) => c.id === reservation.categoryId);
    const settings = store.settings;
    const language = client?.preferredLanguage ?? 'es';
    const templateCode = language === 'en' ? 'CONF_RES_EN_BASE' : 'CONF_RES_ES_BASE';
    const template = store.templates.find((t) => t.templateCode === templateCode && t.active);
    return { reservation, client, category, settings, template, language };
  });

  if (!data) return { ok: false, error: 'Reserva no encontrada' };
  if (!data.client?.email) return { ok: false, error: 'El cliente no tiene email registrado' };
  if (!data.template) return { ok: false, error: 'No hay plantilla de confirmación activa' };

  const { reservation, client, category, settings, template, language } = data;

  const catLabel = [category?.code, category?.name].filter(Boolean).join(' – ');
  const macros: Record<string, string> = {
    company_name: settings.documentName ?? settings.name ?? '',
    company_tax_id: settings.taxId ?? settings.nif ?? '',
    company_fiscal_address: settings.fiscalAddress ?? settings.address ?? '',
    company_phone: settings.companyPhone ?? settings.phone ?? '',
    company_email_from: settings.companyEmailFrom ?? settings.email ?? '',
    company_website: settings.companyWebsite ?? '',
    company_document_footer: settings.documentFooter ?? '',
    company_logo_data_url: settings.logoDataUrl ?? '',
    customer_name: `${client.name}${client.surname ? ' ' + client.surname : ''}`,
    customer_first_name: client.name,
    customer_email: client.email ?? '',
    customer_phone: client.phone ?? '',
    customer_tax_id: client.nif ?? '',
    reservation_number: reservation.number,
    delivery_place: reservation.pickupLocation,
    delivery_date: fmt(reservation.startDate, language),
    delivery_time: reservation.startTime,
    pickup_place: reservation.returnLocation,
    pickup_date: fmt(reservation.endDate, language),
    pickup_time: reservation.endTime,
    billed_car_group: catLabel,
    assigned_plate: reservation.assignedPlate ?? (language === 'en' ? 'To be assigned' : 'Por asignar'),
    billed_days: String(reservation.billedDays),
    base_amount: fmtAmt(reservation.basePrice),
    extras_amount: fmtAmt(reservation.extrasTotal),
    insurance_amount: fmtAmt(reservation.insuranceTotal),
    fuel_amount: fmtAmt(reservation.fuelCharge),
    discount_amount: fmtAmt(reservation.discount),
    total_price: fmtAmt(reservation.total),
    public_observations: reservation.notes ?? '',
  };

  const html = renderTemplateWithMacros(template.htmlContent, macros);
  const subject =
    language === 'en'
      ? `Reservation Confirmation ${reservation.number}`
      : `Confirmación de reserva ${reservation.number}`;
  const from = settings.companyEmailFrom ?? settings.email ?? undefined;

  return sendEmail({ to: client.email!, subject, html, from });
}

// ─── Invoice email ────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(
  invoiceId: string,
  toOverride?: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = withStore((store) => {
    const invoice = store.invoices.find((i) => i.id === invoiceId);
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

  if (!data) return { ok: false, error: 'Factura no encontrada' };

  const { invoice, client, contract, branch, settings, template, language } = data;
  const recipientEmail = toOverride ?? client?.email;
  if (!recipientEmail) return { ok: false, error: 'No hay email destinatario' };
  if (!template) return { ok: false, error: 'No hay plantilla de factura activa' };

  const clientName = client
    ? `${client.name}${client.surname ? ' ' + client.surname : ''}`
    : invoice.clientId;
  const baseImponible =
    invoice.baseAmount +
    invoice.extrasAmount +
    invoice.insuranceAmount +
    invoice.fuelAmount +
    invoice.penalties -
    invoice.discount;

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
  };

  const html = renderTemplateWithMacros(template.htmlContent, macros);
  const subject =
    language === 'en'
      ? `Invoice ${invoice.number}`
      : `Factura ${invoice.number}`;
  const from = settings.companyEmailFrom ?? settings.email ?? undefined;

  return sendEmail({ to: recipientEmail, subject, html, from });
}

// ─── Budget (presupuesto) email ────────────────────────────────────────────────

export interface BudgetEmailPayload {
  clientName: string;
  clientEmail: string;
  language: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  billedDays: number;
  categoryId: string;
  basePrice: number;
  discount: number;
  insuranceTotal: number;
  extrasTotal: number;
  fuelCharge: number;
  total: number;
  notes: string;
}

export async function sendBudgetEmail(
  payload: BudgetEmailPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!payload.clientEmail) return { ok: false, error: 'Email del cliente requerido' };

  const data = withStore((store) => {
    const settings = store.settings;
    const language = payload.language ?? 'es';
    const templateCode = language === 'en' ? 'PRES_BASE_EN' : 'PRES_BASE_ES';
    const template = store.templates.find((t) => t.templateCode === templateCode && t.active);
    const category = store.vehicleCategories.find((c) => c.id === payload.categoryId);
    return { settings, template, language, category };
  });

  if (!data.template) return { ok: false, error: 'No hay plantilla de presupuesto activa' };

  const { settings, template, language, category } = data;
  const catLabel = [category?.code, category?.name].filter(Boolean).join(' – ');

  const macros: Record<string, string> = {
    company_name: settings.documentName ?? settings.name ?? '',
    company_tax_id: settings.taxId ?? settings.nif ?? '',
    company_fiscal_address: settings.fiscalAddress ?? settings.address ?? '',
    company_phone: settings.companyPhone ?? settings.phone ?? '',
    company_email_from: settings.companyEmailFrom ?? settings.email ?? '',
    company_website: settings.companyWebsite ?? '',
    company_document_footer: settings.documentFooter ?? '',
    company_logo_data_url: settings.logoDataUrl ?? '',
    customer_name: payload.clientName,
    customer_email: payload.clientEmail,
    delivery_date: fmt(payload.startDate, language),
    delivery_time: payload.startTime,
    pickup_date: fmt(payload.endDate, language),
    pickup_time: payload.endTime,
    billed_car_group: catLabel,
    billed_days: String(payload.billedDays),
    base_amount: fmtAmt(payload.basePrice),
    discount_amount: fmtAmt(payload.discount),
    insurance_amount: fmtAmt(payload.insuranceTotal),
    extras_amount: fmtAmt(payload.extrasTotal),
    fuel_amount: fmtAmt(payload.fuelCharge),
    total_amount: fmtAmt(payload.total),
    public_observations: payload.notes ?? '',
  };

  const html = renderTemplateWithMacros(template.htmlContent, macros);
  const subject =
    language === 'en'
      ? 'Vehicle rental estimate'
      : 'Presupuesto de alquiler de vehículo';
  const from = settings.companyEmailFrom ?? settings.email ?? undefined;

  return sendEmail({ to: payload.clientEmail, subject, html, from });
}
