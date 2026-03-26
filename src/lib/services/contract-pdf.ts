// contract-pdf.ts — PDFKit contract document builder (2 copies × anverso + reverso)
// Uses PDFKit ^0.18.0 (already installed)

import PDFDocument from 'pdfkit';
import type {
  Contract,
  Client,
  FleetVehicle,
  VehicleModel,
  VehicleCategory,
  CompanySettings,
  CompanyBranch,
} from '@/src/lib/types';

// ─── Public data shape ────────────────────────────────────────────────────────

export interface ContractPdfData {
  contract: Contract;
  client: Client | null;
  vehicle: FleetVehicle | null;
  model: VehicleModel | null;
  category: VehicleCategory | null;
  branch: CompanyBranch | null;
  settings: CompanySettings;
  language: string;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const PW = 595;   // A4 width  (pt)
const PH = 842;   // A4 height (pt)
const ML = 38;    // left margin
const MR = 38;    // right margin
const CW = PW - ML - MR; // content width (519)
const PRIMARY = '#2b6cbd';
const LIGHT_BG = '#f0f7ff';
const BORDER = '#c0c7d1';
const TEXT_COLOR = '#0f172a';
const MUTED_COLOR = '#475569';

// ─── i18n ─────────────────────────────────────────────────────────────────────

function i18n(lang: string) {
  const en = lang.startsWith('en');
  return {
    title:          en ? 'VEHICLE RENTAL CONTRACT'          : 'CONTRATO DE ARRENDAMIENTO DE VEHÍCULO',
    copyCompany:    en ? 'COMPANY COPY'                     : 'COPIA EMPRESA',
    copyClient:     en ? 'CLIENT COPY'                      : 'COPIA CLIENTE',
    contractNo:     en ? 'Contract No.'                     : 'Nº Contrato',
    issueDate:      en ? 'Date'                             : 'Fecha',
    reservation:    en ? 'Reservation'                      : 'Reserva',
    clientData:     en ? 'CLIENT DATA'                      : 'DATOS DEL ARRENDATARIO',
    clientName:     en ? 'Name / Company'                   : 'Nombre / Razón social',
    nif:            en ? 'ID / VAT'                         : 'DNI / NIF',
    licenseNo:      en ? 'License No.'                      : 'Nº Permiso conducir',
    licenseExpiry:  en ? 'Expiry'                           : 'Caducidad',
    phone:          en ? 'Phone'                            : 'Teléfono',
    email:          en ? 'Email'                            : 'Email',
    address:        en ? 'Address'                          : 'Dirección',
    vehicleData:    en ? 'VEHICLE DATA'                     : 'DATOS DEL VEHÍCULO',
    plate:          en ? 'License plate'                    : 'Matrícula',
    category:       en ? 'Category'                         : 'Categoría',
    vehicleModel:   en ? 'Model'                            : 'Modelo',
    color:          en ? 'Color'                            : 'Color',
    year:           en ? 'Year'                             : 'Año',
    kmOut:          en ? 'Km out'                           : 'Km salida',
    fuelOut:        en ? 'Fuel out'                         : 'Comb. salida',
    kmIn:           en ? 'Km in'                            : 'Km entrada',
    fuelIn:         en ? 'Fuel in'                          : 'Comb. entrada',
    period:         en ? 'RENTAL PERIOD'                    : 'PERÍODO DE ARRENDAMIENTO',
    delivery:       en ? 'DELIVERY'                         : 'ENTREGA',
    return:         en ? 'RETURN'                           : 'DEVOLUCIÓN',
    billedDays:     en ? 'Billed days'                      : 'Días facturados',
    pricing:        en ? 'PRICING'                          : 'IMPORTES',
    basePrice:      en ? 'Base rental'                      : 'Alquiler base',
    extras:         en ? 'Extras'                           : 'Extras',
    insurance:      en ? 'Insurance'                        : 'Seguro',
    fuel:           en ? 'Fuel charge'                      : 'Cargo combustible',
    penalties:      en ? 'Penalties'                        : 'Penalizaciones',
    discount:       en ? 'Discount'                         : 'Descuento',
    total:          en ? 'TOTAL'                            : 'TOTAL',
    deposit:        en ? 'Deposit / Pre-auth'               : 'Depósito / Preautorización',
    observations:   en ? 'OBSERVATIONS'                     : 'OBSERVACIONES',
    signatures:     en ? 'SIGNATURES'                       : 'FIRMAS',
    sigCompany:     en ? 'For the company'                  : 'Por la empresa arrendadora',
    sigClient:      en ? 'Renter signature'                 : 'Firma del arrendatario',
    sigDatePlace:   en ? 'Date and place'                   : 'Fecha y lugar',
    backTitle:      en ? 'GENERAL TERMS AND CONDITIONS'     : 'CONDICIONES GENERALES DEL CONTRATO',
    backPlaceholder:en ? 'Add your rental terms and conditions in Settings → Company → Contract back content.'
                       : 'Configura las condiciones generales en Gestor → Empresa → Contenido reverso contrato.',
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(d: string | undefined, lang: string): string {
  if (!d) return '___________';
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return d;
  return lang.startsWith('en') ? `${m}/${day}/${y}` : `${day}/${m}/${y}`;
}

function fmtAmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function blank(n = 24): string {
  return '_'.repeat(n);
}

// ─── PDFKit draw helpers ──────────────────────────────────────────────────────

function hRule(doc: PDFKit.PDFDocument, y: number, color = BORDER, width = 0.5) {
  doc.save().moveTo(ML, y).lineTo(PW - MR, y).strokeColor(color).lineWidth(width).stroke().restore();
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string, y: number): number {
  doc.save().rect(ML, y, CW, 17).fillColor(PRIMARY).fill().restore();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('white');
  doc.text(text, ML + 6, y + 5, { lineBreak: false });
  doc.fillColor(TEXT_COLOR).font('Helvetica');
  return y + 21;
}

function labelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
): number {
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED_COLOR).text(label, x, y, { width: w, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEXT_COLOR).text(value || '—', x, y + 8, { width: w, lineBreak: false, ellipsis: true });
  return y + 20;
}

function inlineField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
) {
  const lw = 72;
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED_COLOR).text(label + ':', x, y, { width: lw, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(TEXT_COLOR).text(value || '—', x + lw + 2, y, { width: w - lw - 6, lineBreak: false, ellipsis: true });
}

// ─── Page header (company + title) ───────────────────────────────────────────

function pageHeader(doc: PDFKit.PDFDocument, settings: CompanySettings, copyLabel: string, lang: string): number {
  let y = 30;

  // Logo (left)
  if (settings.logoDataUrl) {
    try {
      const b64 = settings.logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      doc.image(buf, ML, y, { height: 40, fit: [110, 40] });
    } catch { /* skip if corrupt */ }
  }

  // Company info (right column)
  const companyName = settings.documentName ?? settings.name ?? '';
  const taxId       = settings.taxId ?? settings.nif ?? '';
  const addr        = settings.fiscalAddress ?? settings.address ?? '';
  const phone       = settings.companyPhone ?? settings.phone ?? '';
  const email       = settings.companyEmailFrom ?? settings.email ?? '';
  const web         = settings.companyWebsite ?? '';

  const infoX = ML + 120;
  const infoW = CW - 120;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
     .text(companyName, infoX, y, { width: infoW, align: 'right', lineBreak: false });
  y += 13;

  const meta = [taxId, addr, phone, email, web].filter(Boolean).join('  ·  ');
  doc.font('Helvetica').fontSize(7).fillColor(MUTED_COLOR)
     .text(meta, infoX, y, { width: infoW, align: 'right', lineBreak: false });
  y = 78;

  hRule(doc, y, PRIMARY, 1);
  y += 8;

  // Document title
  const t = i18n(lang);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(PRIMARY)
     .text(t.title, ML, y, { width: CW - 88, lineBreak: false });

  // Copy badge
  doc.save().rect(PW - MR - 86, y - 3, 86, 16).fillColor(PRIMARY).fill().restore();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('white')
     .text(copyLabel, PW - MR - 86, y + 2, { width: 86, align: 'center', lineBreak: false });
  doc.fillColor(TEXT_COLOR).font('Helvetica');

  y += 24;
  hRule(doc, y, BORDER);
  return y + 8;
}

// ─── Anverso (front page) ─────────────────────────────────────────────────────

function renderAnverso(
  doc: PDFKit.PDFDocument,
  data: ContractPdfData,
  copyLabel: string,
  isBlank: boolean,
): void {
  const { contract, client, vehicle, model, category, branch, settings } = data;
  const lang = data.language;
  const t = i18n(lang);

  const v = <T,>(real: T | undefined | null, fallback = blank()): string =>
    isBlank ? fallback : (real != null ? String(real) : '—');

  let y = pageHeader(doc, settings, copyLabel, lang);

  // ── Contract reference row ──────────────────────────────────────────────────
  const col3 = CW / 3;
  inlineField(doc, t.contractNo, v(contract?.number, blank(12)), ML, y, col3);
  inlineField(doc, t.issueDate,  v(contract ? fmtDate(contract.createdAt?.slice(0, 10), lang) : undefined, blank(10)), ML + col3, y, col3);
  if (!isBlank && (contract as any)?.reservationId) {
    inlineField(doc, t.reservation, String((contract as any).reservationId ?? ''), ML + col3 * 2, y, col3);
  }
  y += 16;

  // ── Client data ─────────────────────────────────────────────────────────────
  y = sectionHeader(doc, t.clientData, y);

  const col2 = CW / 2;
  const clientFullName = client ? `${client.name}${client.surname ? ' ' + client.surname : ''}` : '';

  labelValue(doc, t.clientName, v(clientFullName), ML, y, col2);
  labelValue(doc, t.nif, v(client?.nif), ML + col2, y, col2);
  y += 20;

  labelValue(doc, t.phone, v(client?.phone), ML, y, col2);
  labelValue(doc, t.email, v(client?.email), ML + col2, y, col2);
  y += 20;

  labelValue(doc, t.licenseNo, v(client?.licenseNumber), ML, y, col3);
  labelValue(doc, t.licenseExpiry, v(client?.licenseExpiry ? fmtDate(client.licenseExpiry, lang) : undefined), ML + col3, y, col3);
  labelValue(doc, t.address, v(client?.address), ML + col3 * 2, y, col3);
  y += 22;

  // ── Vehicle data ────────────────────────────────────────────────────────────
  y = sectionHeader(doc, t.vehicleData, y);

  const modelLabel = model ? `${model.brand} ${model.model}` : '';

  labelValue(doc, t.plate,         v(contract?.plate),    ML,             y, col3);
  labelValue(doc, t.category,      v(category?.name),     ML + col3,      y, col3);
  labelValue(doc, t.vehicleModel,  v(modelLabel),         ML + col3 * 2,  y, col3);
  y += 20;

  const col4 = CW / 4;
  labelValue(doc, t.color,    v(vehicle?.color),              ML,               y, col4);
  labelValue(doc, t.year,     v(vehicle?.year),               ML + col4,        y, col4);
  labelValue(doc, t.kmOut,    v(contract?.checkout?.kmOut),   ML + col4 * 2,    y, col4);
  labelValue(doc, t.kmIn,     v(contract?.checkin?.kmIn),     ML + col4 * 3,    y, col4);
  y += 22;

  // ── Rental period ───────────────────────────────────────────────────────────
  y = sectionHeader(doc, t.period, y);

  const boxW = (CW - 8) / 2;
  const boxH = 44;

  // Delivery box
  doc.save().rect(ML, y, boxW, boxH).fillColor(LIGHT_BG).fill()
     .strokeColor(PRIMARY).lineWidth(0.8).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PRIMARY)
     .text(t.delivery, ML + 6, y + 5, { lineBreak: false });
  const delivDate = isBlank ? blank(12) : `${fmtDate(contract?.startDate, lang)}  ${contract?.startTime ?? ''}`;
  const delivLoc  = isBlank ? blank(20) : (contract?.pickupLocation || branch?.name || '—');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_COLOR)
     .text(delivDate, ML + 6, y + 16, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED_COLOR)
     .text(delivLoc, ML + 6, y + 28, { width: boxW - 12, lineBreak: false, ellipsis: true });

  // Return box
  const rx = ML + boxW + 8;
  doc.save().rect(rx, y, boxW, boxH).fillColor(LIGHT_BG).fill()
     .strokeColor(PRIMARY).lineWidth(0.8).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PRIMARY)
     .text(t.return, rx + 6, y + 5, { lineBreak: false });
  const retDate = isBlank ? blank(12) : `${fmtDate(contract?.endDate, lang)}  ${contract?.endTime ?? ''}`;
  const retLoc  = isBlank ? blank(20) : (contract?.returnLocation || branch?.name || '—');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_COLOR)
     .text(retDate, rx + 6, y + 16, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED_COLOR)
     .text(retLoc, rx + 6, y + 28, { width: boxW - 12, lineBreak: false, ellipsis: true });

  y += boxH + 6;
  inlineField(doc, t.billedDays, v(contract?.billedDays, blank(4)), ML, y, col3);
  y += 14;

  // ── Pricing ─────────────────────────────────────────────────────────────────
  y = sectionHeader(doc, t.pricing, y);

  const labelW = CW * 0.65;
  const amtW   = CW - labelW;

  function priceRow(label: string, amount: string, strikethrough = false) {
    doc.font('Helvetica').fontSize(8).fillColor(TEXT_COLOR)
       .text(label, ML, y, { width: labelW, lineBreak: false });
    doc.font(strikethrough ? 'Helvetica' : 'Helvetica').fontSize(8)
       .fillColor(strikethrough ? MUTED_COLOR : TEXT_COLOR)
       .text(amount, ML + labelW, y, { width: amtW, align: 'right', lineBreak: false });
    y += 12;
  }

  if (isBlank) {
    priceRow(t.basePrice,  blank(8));
    priceRow(t.extras,     blank(8));
    priceRow(t.insurance,  blank(8));
    priceRow(t.fuel,       blank(8));
  } else {
    if (contract.basePrice > 0)       priceRow(t.basePrice,  fmtAmt(contract.basePrice));
    if (contract.extrasTotal > 0)     priceRow(t.extras,     fmtAmt(contract.extrasTotal));
    if (contract.insuranceTotal > 0)  priceRow(t.insurance,  fmtAmt(contract.insuranceTotal));
    if (contract.fuelCharge > 0)      priceRow(t.fuel,       fmtAmt(contract.fuelCharge));
    if (contract.penalties > 0)       priceRow(t.penalties,  fmtAmt(contract.penalties));
    if (contract.discount > 0)        priceRow(t.discount,   '− ' + fmtAmt(contract.discount));
  }

  hRule(doc, y, BORDER);
  y += 4;

  // Total row
  const totalVal = isBlank ? blank(8) : fmtAmt(contract.total);
  doc.save().rect(ML + labelW - 2, y - 1, amtW + 2, 16).fillColor(PRIMARY).fill().restore();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_COLOR)
     .text(t.total, ML, y + 3, { width: labelW, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('white')
     .text(totalVal, ML + labelW, y + 3, { width: amtW, align: 'right', lineBreak: false });
  doc.fillColor(TEXT_COLOR);
  y += 20;

  // Deposit line
  const depositVal = isBlank ? blank(8) : fmtAmt(settings.defaultDeposit ?? 0);
  inlineField(doc, t.deposit, depositVal, ML, y, col2);
  y += 14;

  // ── Observations ────────────────────────────────────────────────────────────
  const obs = isBlank ? '' : (contract?.notes ?? '');
  y = sectionHeader(doc, t.observations, y);
  const obsH = 28;
  doc.save().rect(ML, y, CW, obsH).strokeColor(BORDER).lineWidth(0.5).stroke().restore();
  if (obs) {
    doc.font('Helvetica').fontSize(8).fillColor(TEXT_COLOR)
       .text(obs, ML + 4, y + 4, { width: CW - 8, height: obsH - 8 });
  }
  y += obsH + 6;

  // ── Signatures ──────────────────────────────────────────────────────────────
  // Check remaining space
  const sigH = 56;
  if (y + sigH + 30 > PH - 30) {
    // No room — skip signatures (rare for normal contracts)
  } else {
    y = sectionHeader(doc, t.signatures, y);

    const sigW = (CW - 10) / 2;

    // Company sig box
    doc.save().rect(ML, y, sigW, sigH).strokeColor(BORDER).lineWidth(0.5).stroke().restore();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PRIMARY)
       .text(t.sigCompany, ML + 4, y + 4, { lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(MUTED_COLOR)
       .text(t.sigDatePlace + ':  ___________________', ML + 4, y + sigH - 12, { lineBreak: false });

    // Client sig box
    const sx = ML + sigW + 10;
    doc.save().rect(sx, y, sigW, sigH).strokeColor(BORDER).lineWidth(0.5).stroke().restore();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PRIMARY)
       .text(t.sigClient, sx + 4, y + 4, { lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(MUTED_COLOR)
       .text(t.sigDatePlace + ':  ___________________', sx + 4, y + sigH - 12, { lineBreak: false });

    // Embed digital signature if available
    if (!isBlank && contract?.checkout?.signatureUrl) {
      try {
        const b64 = contract.checkout.signatureUrl.replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(b64, 'base64');
        doc.image(buf, sx + 4, y + 14, { height: 28, fit: [sigW - 10, 28] });
      } catch { /* ignore */ }
    }

    y += sigH + 8;
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footer = settings.documentFooter ?? '';
  if (footer && y < PH - 30) {
    hRule(doc, PH - 28, BORDER);
    doc.font('Helvetica').fontSize(6.5).fillColor(MUTED_COLOR)
       .text(footer, ML, PH - 22, { width: CW, align: 'center', lineBreak: false });
  }
}

// ─── Reverso (back page — terms) ─────────────────────────────────────────────

function renderReverso(doc: PDFKit.PDFDocument, settings: CompanySettings, lang: string): void {
  const t = i18n(lang);
  const isEn = lang.startsWith('en');

  let content = isEn
    ? (settings.contractBackContentEn ?? settings.contractBackContent ?? '')
    : (settings.contractBackContentEs ?? settings.contractBackContent ?? '');

  let y = 34;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(PRIMARY)
     .text(t.backTitle, ML, y, { width: CW, align: 'center', lineBreak: false });
  y += 18;
  hRule(doc, y, PRIMARY, 1);
  y += 10;

  if (!content) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED_COLOR)
       .text(t.backPlaceholder, ML, y, { width: CW });
    return;
  }

  // Strip HTML tags if content is HTML
  if ((settings.contractBackContentType ?? 'TEXT') === 'HTML') {
    content = content.replace(/<br\s*\/?>/gi, '\n')
                     .replace(/<\/p>/gi, '\n\n')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/&nbsp;/g, ' ')
                     .replace(/&amp;/g, '&')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/[ \t]+/g, ' ')
                     .trim();
  }

  const fontSize = Math.max(6, Math.min(10, settings.contractBackFontSize ?? 8));
  doc.font('Helvetica').fontSize(fontSize).fillColor(TEXT_COLOR)
     .text(content, ML, y, { width: CW, align: 'justify', lineBreak: true });
}

// ─── Public builders ──────────────────────────────────────────────────────────

export function buildContractPdf(data: ContractPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const lang = data.language ?? 'es';
      const t = i18n(lang);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: true,
        info: {
          Title:  data.contract?.number ?? 'Contrato',
          Author: data.settings.documentName ?? data.settings.name ?? 'RentIQ',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page 1 — EMPRESA anverso
      renderAnverso(doc, data, t.copyCompany, false);

      // Page 2 — EMPRESA reverso
      doc.addPage();
      renderReverso(doc, data.settings, lang);

      // Page 3 — CLIENTE anverso
      doc.addPage();
      renderAnverso(doc, data, t.copyClient, false);

      // Page 4 — CLIENTE reverso
      doc.addPage();
      renderReverso(doc, data.settings, lang);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export function buildBlankContractPdf(settings: CompanySettings, lang: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const t = i18n(lang);

      const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const blankData: ContractPdfData = {
        contract:  {} as Contract,
        client:    null,
        vehicle:   null,
        model:     null,
        category:  null,
        branch:    null,
        settings,
        language: lang,
      };

      renderAnverso(doc, blankData, t.copyCompany, true);

      doc.addPage();
      renderReverso(doc, settings, lang);

      doc.addPage();
      renderAnverso(doc, blankData, t.copyClient, true);

      doc.addPage();
      renderReverso(doc, settings, lang);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
