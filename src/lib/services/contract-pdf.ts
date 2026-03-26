// contract-pdf.ts — PDFKit contract builder (2 copies × anverso + reverso)
// Diseño tipo contrato de alquiler profesional, dos columnas, reverso bilingüe

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

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ContractPdfData {
  contract: Contract;
  client: Client | null;
  vehicle: FleetVehicle | null;
  model: VehicleModel | null;
  category: VehicleCategory | null;
  branch: CompanyBranch | null;
  settings: CompanySettings;
  language: string;
  pickupFlight?: string;
  returnFlight?: string;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const PW  = 595;
const PH  = 842;
const ML  = 30;   // left margin
const MR  = 30;   // right margin
const CW  = PW - ML - MR;  // 535

// Two-column grid
const C1W  = 249;
const CGAP = 17;
const C2W  = CW - C1W - CGAP;  // 269
const C2X  = ML + C1W + CGAP;

// Colors
const PRIMARY    = '#2b6cbd';
const BORDER_CLR = '#d1d5db';
const LABEL_CLR  = '#6b7280';
const TXT_CLR    = '#111827';
const SUBHDR_BG  = '#f3f4f6';
const SUBHDR_CLR = '#9ca3af';
const TOTAL_BG   = '#eff6ff';

// ─── i18n ─────────────────────────────────────────────────────────────────────

interface Strings {
  titleDoc: string; copyCompany: string; copyClient: string; contractNo: string;
  vehicleData: string; brandModel: string; plate: string; color: string;
  group: string; fuelLabel: string;
  mainDriver: string; clientLabel: string; birthDate: string; document: string;
  license: string; docExpiry: string; licExpiry: string; nationality: string;
  permAddress: string; phones: string; phoneFix: string; mobile: string;
  addDrivers: string; noAddDrivers: string;
  companySection: string; companyCIF: string; fiscalAddr: string; contact: string;
  rentalData: string; pickupLocation: string; returnLocation: string;
  deliveryDate: string; returnDate: string; deliveryTime: string; returnTime: string;
  deliveryFlight: string; returnFlight: string;
  techData: string; totalDays: string; groupBilled: string; tariffCode: string;
  breakdown: string; base: string; discount: string; extras: string;
  fuelCharge: string; insurance: string; penalties: string; total: string; franchise: string;
  vehicleSection: string; vehicleChanges: string; noChanges: string;
  observations: string; noObs: string;
  sigTextEs: string; sigTextEn: string;
  sigRenter: string; sigCompany: string;
  na: string;
}

function strings(lang: string): Strings {
  const en = lang.startsWith('en');
  return {
    titleDoc:       en ? 'Car Rental Contract'              : 'Contrato de alquiler',
    copyCompany:    en ? 'COMPANY COPY'                     : 'COPIA EMPRESA',
    copyClient:     en ? 'CLIENT COPY'                      : 'COPIA CLIENTE',
    contractNo:     en ? 'No.'                              : 'Nº',
    vehicleData:    en ? 'Vehicle data'                     : 'Datos del vehículo',
    brandModel:     en ? 'Make / Model'                     : 'Marca / modelo',
    plate:          en ? 'License plate'                    : 'Matrícula',
    color:          en ? 'Color'                            : 'Color',
    group:          en ? 'Group'                            : 'Grupo',
    fuelLabel:      en ? 'Fuel'                             : 'Combustible',
    mainDriver:     en ? 'Main driver'                      : 'Conductor principal',
    clientLabel:    en ? 'Client'                           : 'Cliente',
    birthDate:      en ? 'Date of birth'                    : 'Fecha nacimiento',
    document:       en ? 'Document'                         : 'Documento',
    license:        en ? 'Driving license'                  : 'Permiso de conducir',
    docExpiry:      en ? 'Doc. expiry'                      : 'Caducidad documento',
    licExpiry:      en ? 'Lic. expiry'                      : 'Caducidad permiso',
    nationality:    en ? 'Nationality'                      : 'Nacionalidad',
    permAddress:    en ? 'PERMANENT ADDRESS'                : 'DIRECCIÓN PERMANENTE',
    phones:         en ? 'PHONES'                           : 'TELÉFONOS',
    phoneFix:       en ? 'Phone'                            : 'Teléfono',
    mobile:         en ? 'Mobile'                           : 'Móvil',
    addDrivers:     en ? 'Additional drivers'               : 'Conductores adicionales',
    noAddDrivers:   en ? 'No additional drivers'            : 'Sin conductores adicionales',
    companySection: en ? 'Company'                          : 'Empresa',
    companyCIF:     en ? 'VAT no.'                          : 'CIF',
    fiscalAddr:     en ? 'Fiscal address'                   : 'Domicilio fiscal',
    contact:        en ? 'Contact'                          : 'Contacto',
    rentalData:     en ? 'Rental data'                      : 'Datos del alquiler',
    pickupLocation: en ? 'Pickup location'                  : 'Lugar entrega',
    returnLocation: en ? 'Return location'                  : 'Lugar recogida',
    deliveryDate:   en ? 'Delivery date'                    : 'Fecha entrega',
    returnDate:     en ? 'Return date'                      : 'Fecha recogida',
    deliveryTime:   en ? 'Delivery time'                    : 'Hora entrega',
    returnTime:     en ? 'Return time'                      : 'Hora recogida',
    deliveryFlight: en ? 'Delivery flight'                  : 'Vuelo entrega',
    returnFlight:   en ? 'Return flight'                    : 'Vuelo recogida',
    techData:       en ? 'Technical billing data'           : 'Datos técnicos de facturación',
    totalDays:      en ? 'Total billed days'                : 'Total días facturados',
    groupBilled:    en ? 'Billed / delivered group'         : 'Grupo facturado / entregado',
    tariffCode:     en ? 'Rate code'                        : 'Código tarifa',
    breakdown:      en ? 'Billing breakdown'                : 'Desglose de facturación',
    base:           en ? 'Base'                             : 'Base',
    discount:       en ? 'Discount'                         : 'Descuento',
    extras:         en ? 'Extras'                           : 'Extras',
    fuelCharge:     en ? 'Fuel'                             : 'Combustible',
    insurance:      en ? 'CDW / Insurance'                  : 'CDW / Seguro',
    penalties:      en ? 'Penalties'                        : 'Penalizaciones',
    total:          en ? 'Total'                            : 'Total',
    franchise:      en ? 'Excess / Franchise'               : 'Franquicia',
    vehicleSection: en ? 'Vehicle'                          : 'Vehículo',
    vehicleChanges: en ? 'Vehicle changes'                  : 'Cambios de vehículo',
    noChanges:      en ? 'No vehicle changes recorded'      : 'Sin cambios de vehículo registrados',
    observations:   en ? 'Observations'                     : 'Observaciones',
    noObs:          en ? 'No observations'                  : 'Sin observaciones',
    sigTextEs:      'He leído y entiendo los términos y condiciones del presente contrato de alquiler y autorizo con mi firma que todos los importes derivados de este alquiler sean cargados en mi tarjeta de crédito.',
    sigTextEn:      'I have read and agreed the terms of this rental agreement and I authorize with my signature that all amounts derived from this rent are charged to my credit card, deposit or others.',
    sigRenter:      en ? 'Renter signature'                 : 'Firma arrendatario',
    sigCompany:     en ? 'Company signature'                : 'Firma empresa',
    na:             'N/D',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | undefined, lang: string): string {
  if (!d) return 'N/D';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const [y, m, day] = parts;
  return lang.startsWith('en') ? `${m}/${day}/${y}` : `${day}/${m}/${y}`;
}

function fmtAmt(n: number): string {
  return n.toFixed(2);
}

function blankLine(n = 20): string {
  return '_'.repeat(n);
}

function fuelStr(fuel: string | undefined, lang: string): string {
  if (!fuel) return 'N/D';
  if (lang.startsWith('en')) {
    return ({GASOLINA: 'Petrol', DIESEL: 'Diesel', ELECTRICO: 'Electric', HIBRIDO: 'Hybrid'}[fuel] ?? fuel);
  }
  return ({GASOLINA: 'Gasolina', DIESEL: 'Diésel', ELECTRICO: 'Eléctrico', HIBRIDO: 'Híbrido'}[fuel] ?? fuel);
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function hline(doc: PDFKit.PDFDocument, y: number, x1 = ML, x2 = PW - MR, color = BORDER_CLR, lw = 0.5) {
  doc.save().moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke().restore();
}

// Bordered section box with blue title — returns innerY (after title row)
function secBox(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number, y: number, w: number, h: number,
): number {
  doc.save().roundedRect(x, y, w, h, 2).strokeColor(BORDER_CLR).lineWidth(0.5).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY)
     .text(title, x + 7, y + 6, { width: w - 14, lineBreak: false });
  hline(doc, y + 17, x + 2, x + w - 2, BORDER_CLR, 0.3);
  return y + 20;
}

// Stacked label + value field
function field(
  doc: PDFKit.PDFDocument,
  label: string, value: string,
  x: number, y: number, w: number,
) {
  doc.font('Helvetica').fontSize(6).fillColor(LABEL_CLR)
     .text(label, x, y, { width: w, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
     .text(value || 'N/D', x, y + 7, { width: w, lineBreak: false, ellipsis: true });
}

// Gray subheader stripe inside a section
function subHdr(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number, y: number, w: number,
): number {
  doc.save().rect(x, y, w, 11).fillColor(SUBHDR_BG).fill().restore();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(SUBHDR_CLR)
     .text(text, x + 4, y + 3, { width: w - 8, lineBreak: false, align: 'center' });
  return y + 13;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function drawHeader(
  doc: PDFKit.PDFDocument,
  settings: CompanySettings,
  contractNum: string,
  copyLabel: string,
  lang: string,
): number {
  const tr = strings(lang);
  let y = 22;

  // Logo
  if (settings.logoDataUrl) {
    try {
      const b64 = settings.logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      doc.image(buf, ML, y, { height: 44, fit: [100, 44] });
    } catch { /* skip */ }
  }

  // Company block (center-left)
  const cx = ML + 108;
  const cw = CW - 108 - 120;
  const name = settings.documentName ?? settings.name ?? '';
  const nif  = settings.taxId ?? settings.nif ?? '';
  const addr = settings.fiscalAddress ?? settings.address ?? '';

  doc.font('Helvetica-Bold').fontSize(11).fillColor(TXT_CLR)
     .text(name, cx, y + 2, { width: cw, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(nif, cx, y + 15, { width: cw, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(addr, cx, y + 24, { width: cw, lineBreak: false });

  // Contract number (top-right)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TXT_CLR)
     .text(`${tr.contractNo} ${contractNum}`, PW - MR - 118, y + 2, { width: 118, align: 'right', lineBreak: false });

  // Copy badge
  const badgeY = y + 18;
  doc.save().roundedRect(PW - MR - 102, badgeY, 102, 15, 3).fillColor(PRIMARY).fill().restore();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('white')
     .text(copyLabel, PW - MR - 102, badgeY + 4, { width: 102, align: 'center', lineBreak: false });

  y = 74;
  hline(doc, y, ML, PW - MR, PRIMARY, 1.5);
  y += 8;

  // Title
  doc.font('Helvetica-Bold').fontSize(18).fillColor(TXT_CLR)
     .text(tr.titleDoc, ML, y, { lineBreak: false });
  y += 26;
  hline(doc, y, ML, PW - MR, BORDER_CLR, 0.5);
  return y + 6;
}

// ─── Anverso ──────────────────────────────────────────────────────────────────

function renderAnverso(
  doc: PDFKit.PDFDocument,
  data: ContractPdfData,
  copyLabel: string,
  isBlank: boolean,
): void {
  const { contract, client, vehicle, model, category, settings } = data;
  const lang = data.language;
  const tr = strings(lang);

  // Value helper: real or blank
  const v = (val: string | number | undefined | null, fb = 'N/D'): string =>
    isBlank ? blankLine() : (val != null && String(val).trim() !== '' ? String(val) : fb);

  const num = isBlank ? '' : (contract?.number ?? '');
  let y = drawHeader(doc, settings, num, copyLabel, lang);

  // ── Datos del vehículo (full width) ───────────────────────────────────────

  const VH = 50;
  const vInner = secBox(doc, tr.vehicleData, ML, y, CW, VH);

  // 5 horizontal columns inside vehicle box
  const vcols = [CW * 0.30, CW * 0.17, CW * 0.13, CW * 0.13, CW * 0.27];
  let vx = ML + 7;
  const modelStr = model ? `${model.brand} ${model.model}` : '';
  const vFields: [string, string][] = [
    [tr.brandModel,  v(modelStr)],
    [tr.plate,       v(contract?.plate)],
    [tr.color,       v(vehicle?.color)],
    [tr.group,       v(category?.code ?? category?.name)],
    [tr.fuelLabel,   v(fuelStr(model?.fuel, lang))],
  ];
  for (let i = 0; i < vFields.length; i++) {
    field(doc, vFields[i][0], vFields[i][1], vx, vInner + 4, vcols[i] - 8);
    vx += vcols[i];
    if (i < vFields.length - 1) {
      doc.save().moveTo(vx - 4, vInner + 2).lineTo(vx - 4, y + VH - 4)
         .strokeColor(BORDER_CLR).lineWidth(0.3).stroke().restore();
    }
  }
  y += VH + 4;

  // ── Row 1: Conductor principal (left) | Datos del alquiler (right) ────────

  let ly = y, ry = y;

  // LEFT: Conductor principal
  const cpH = 154;
  const cpInner = secBox(doc, tr.mainDriver, ML, ly, C1W, cpH);
  let cpY = cpInner + 3;
  const c2w = (C1W - 16) / 2;

  const clientName = client ? `${client.name}${client.surname ? ' ' + client.surname : ''}` : '';
  field(doc, tr.clientLabel,    v(clientName),                      ML + 7, cpY, C1W * 0.58 - 4);
  field(doc, tr.birthDate,      'N/D',                              ML + 7 + C1W * 0.58, cpY, C1W * 0.42 - 14);
  cpY += 20;

  field(doc, tr.document,       client?.nif ? `DNI ${client.nif}` : v(undefined), ML + 7, cpY, c2w);
  field(doc, tr.license,        v(client?.licenseNumber),           ML + 7 + c2w + 4, cpY, c2w);
  cpY += 20;

  field(doc, tr.docExpiry,      'N/D',                              ML + 7, cpY, c2w * 0.6);
  field(doc, tr.licExpiry,      v(client?.licenseExpiry ? fmtDate(client.licenseExpiry, lang) : undefined), ML + 7 + c2w * 0.6 + 4, cpY, c2w * 0.6);
  field(doc, tr.nationality,    'N/D',                              ML + 7 + c2w * 1.2 + 8, cpY, C1W - (7 + c2w * 1.2 + 8) - 4);
  cpY += 20;

  cpY = subHdr(doc, tr.permAddress, ML + 4, cpY, C1W - 8);
  const addrParts = [client?.address, client?.city, client?.country].filter(Boolean);
  const addrStr = addrParts.length > 0 ? addrParts.join(', ') : 'N/D';
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
     .text(v(addrStr !== 'N/D' ? addrStr : undefined), ML + 7, cpY, { width: C1W - 14, lineBreak: false, ellipsis: true });
  cpY += 10;
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text('N/D', ML + 7, cpY, { lineBreak: false });
  cpY += 10;

  cpY = subHdr(doc, tr.phones, ML + 4, cpY, C1W - 8);
  field(doc, tr.phoneFix, v(client?.phone), ML + 7, cpY, c2w);
  field(doc, tr.mobile,   'N/D',            ML + 7 + c2w + 4, cpY, c2w);

  ly += cpH + 4;

  // RIGHT: Datos del alquiler
  const daH = 154;
  const daInner = secBox(doc, tr.rentalData, C2X, ry, C2W, daH);
  let daY = daInner + 3;
  const rc2w = (C2W - 16) / 2;

  const hasFlight = !!(data.pickupFlight || data.returnFlight);

  field(doc, tr.pickupLocation, v(contract?.pickupLocation), C2X + 7, daY, rc2w);
  field(doc, tr.returnLocation, v(contract?.returnLocation), C2X + 7 + rc2w + 4, daY, rc2w);
  daY += 20;

  field(doc, tr.deliveryDate, v(contract ? fmtDate(contract.startDate, lang) : undefined), C2X + 7, daY, rc2w);
  field(doc, tr.returnDate,   v(contract ? fmtDate(contract.endDate, lang) : undefined),   C2X + 7 + rc2w + 4, daY, rc2w);
  daY += 20;

  field(doc, tr.deliveryTime, v(contract?.startTime), C2X + 7, daY, rc2w);
  field(doc, tr.returnTime,   v(contract?.endTime),   C2X + 7 + rc2w + 4, daY, rc2w);
  daY += 20;

  field(doc, tr.deliveryFlight, v(data.pickupFlight), C2X + 7, daY, rc2w);
  field(doc, tr.returnFlight,   v(data.returnFlight), C2X + 7 + rc2w + 4, daY, rc2w);
  daY += 20;

  // Extra row: billed days
  field(doc, tr.totalDays, v(contract?.billedDays), C2X + 7, daY, rc2w);

  ry += daH + 4;
  y = Math.max(ly, ry);

  // ── Row 2: Conductores adicionales (left) | Datos técnicos (right) ────────

  ly = y; ry = y;

  const caH = 44;
  secBox(doc, tr.addDrivers, ML, ly, C1W, caH);
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(tr.noAddDrivers, ML + 7, ly + 24, { lineBreak: false });
  ly += caH + 4;

  const dtH = 44;
  const dtInner = secBox(doc, tr.techData, C2X, ry, C2W, dtH);
  let dtY = dtInner + 3;

  function dtRow(lbl: string, val: string) {
    const lw = C2W * 0.7;
    doc.font('Helvetica').fontSize(6.5).fillColor(LABEL_CLR)
       .text(lbl, C2X + 7, dtY, { width: lw, lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(TXT_CLR)
       .text(val, C2X + lw, dtY, { width: C2W - lw - 8, align: 'right', lineBreak: false });
    dtY += 9;
  }

  const catCode = category?.code ?? category?.name ?? 'N/D';
  dtRow(tr.totalDays,   v(contract?.billedDays));
  dtRow(tr.groupBilled, isBlank ? 'N/D' : `${catCode} / ${catCode}`);
  dtRow(tr.tariffCode,  'N/D');

  ry += dtH + 4;
  y = Math.max(ly, ry);

  // ── Row 3: Empresa (left) | Desglose de facturación (right) ──────────────

  ly = y; ry = y;

  const emH = 72;
  const emInner = secBox(doc, tr.companySection, ML, ly, C1W, emH);
  let emY = emInner + 4;
  const emPairs: [string, string][] = [
    [tr.companySection, blankLine(22)],
    [tr.companyCIF,     blankLine(14)],
    [tr.fiscalAddr,     blankLine(22)],
    [tr.contact,        blankLine(22)],
  ];
  for (const [lbl, val] of emPairs) {
    field(doc, lbl, val, ML + 7, emY, C1W - 14);
    emY += 14;
  }
  ly += emH + 4;

  // RIGHT: Desglose
  type Row = [string, number | null, boolean];
  let rows: Row[];
  if (isBlank) {
    rows = [
      [tr.base,       null, false],
      [tr.discount,   null, false],
      [tr.extras,     null, false],
      [tr.fuelCharge, null, false],
      [tr.insurance,  null, false],
      [tr.total,      null, true ],
    ];
  } else {
    rows = [
      [tr.base,       contract.basePrice,      false],
      [tr.discount,   contract.discount,       false],
      [tr.extras,     contract.extrasTotal,    false],
      [tr.fuelCharge, contract.fuelCharge,     false],
      [tr.insurance,  contract.insuranceTotal, false],
    ];
    if (contract.penalties > 0) rows.push([tr.penalties, contract.penalties, false]);
    rows.push([tr.total, contract.total, true]);
  }

  const rowH = 12;
  const deH = Math.max(emH, rows.length * rowH + 30);
  const deInner = secBox(doc, tr.breakdown, C2X, ry, C2W, deH);
  let deY = deInner + 4;

  for (const [lbl, amt, bold] of rows) {
    const valStr = isBlank ? blankLine(8) : fmtAmt(amt ?? 0);
    if (bold) {
      doc.save().rect(C2X + 2, deY - 2, C2W - 4, 14).fillColor(TOTAL_BG).fill().restore();
    }
    const lw = C2W * 0.62;
    const vw = C2W - lw - 10;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
       .fillColor(bold ? PRIMARY : LABEL_CLR)
       .text(lbl, C2X + 7, deY, { width: lw, lineBreak: false });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
       .fillColor(TXT_CLR)
       .text(valStr, C2X + lw, deY, { width: vw, align: 'right', lineBreak: false });
    deY += rowH;
  }

  // Franquicia row
  deY += 2;
  hline(doc, deY, C2X + 4, C2X + C2W - 4, BORDER_CLR, 0.3);
  deY += 4;
  const lw2 = C2W * 0.62;
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(tr.franchise, C2X + 7, deY, { width: lw2, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
     .text('N/D', C2X + lw2, deY, { width: C2W - lw2 - 10, align: 'right', lineBreak: false });

  ry += deH + 4;
  y = Math.max(ly, ry);

  // ── Row 4: Vehículo (left) | Cambios + Observaciones (right) ─────────────

  ly = y; ry = y;

  const vehH = 90;
  secBox(doc, tr.vehicleSection, ML, ly, C1W, vehH);
  // Vehicle silhouette placeholder
  const vbx = ML + 8, vby = ly + 22, vbw = C1W - 16, vbh = vehH - 28;
  doc.save().rect(vbx, vby, vbw, vbh).fillColor('#f9fafb').fill()
     .strokeColor('#e5e7eb').lineWidth(0.4).stroke().restore();
  const plateStr = isBlank ? '' : (contract?.plate ?? '');
  if (plateStr) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#d1d5db')
       .text(plateStr, vbx, vby + vbh / 2 - 5, { width: vbw, align: 'center', lineBreak: false });
  }
  ly += vehH + 4;

  const chH = 38;
  secBox(doc, tr.vehicleChanges, C2X, ry, C2W, chH);
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(tr.noChanges, C2X + 7, ry + 23, { lineBreak: false });
  ry += chH + 4;

  const obsText = isBlank ? '' : (contract?.notes ?? '');
  const obsH = vehH - chH - 4;
  secBox(doc, tr.observations, C2X, ry, C2W, obsH);
  if (obsText) {
    doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
       .text(obsText, C2X + 7, ry + 22, { width: C2W - 14, height: obsH - 28, lineBreak: true });
  } else {
    doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
       .text(tr.noObs, C2X + 7, ry + 23, { lineBreak: false });
  }
  ry += obsH + 4;

  y = Math.max(ly, ry) + 4;

  // ── Signature section ──────────────────────────────────────────────────────

  hline(doc, y, ML, PW - MR, BORDER_CLR, 0.5);
  y += 6;

  // Both languages side by side
  doc.font('Helvetica').fontSize(6.5).fillColor(LABEL_CLR)
     .text(tr.sigTextEs, ML, y, { width: CW, lineBreak: false });
  y += 9;
  doc.font('Helvetica').fontSize(6.5).fillColor(LABEL_CLR)
     .text('* ' + tr.sigTextEn, ML, y, { width: CW, lineBreak: false });
  y += 14;

  // Signature boxes
  const sigW = CW / 2 - 8;
  const sigH = 44;

  doc.save().roundedRect(ML, y, sigW, sigH, 2).strokeColor(BORDER_CLR).lineWidth(0.5).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TXT_CLR)
     .text(tr.sigRenter, ML + 6, y + 5, { lineBreak: false });

  const sx2 = ML + sigW + 16;
  doc.save().roundedRect(sx2, y, sigW, sigH, 2).strokeColor(BORDER_CLR).lineWidth(0.5).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TXT_CLR)
     .text(tr.sigCompany, sx2 + 6, y + 5, { lineBreak: false });

  // Embed digital signature if available
  if (!isBlank && contract?.checkout?.signatureUrl) {
    try {
      const b64 = contract.checkout.signatureUrl.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      doc.image(buf, ML + 4, y + 14, { height: 26, fit: [sigW - 8, 26] });
    } catch { /* ignore */ }
  }

  y += sigH + 6;

  // ── Page footer ────────────────────────────────────────────────────────────

  const footerText = settings.documentFooter
    ?? [settings.documentName ?? settings.name ?? '', settings.fiscalAddress ?? settings.address ?? ''].filter(Boolean).join('  ·  ');

  hline(doc, PH - 22, ML, PW - MR, BORDER_CLR, 0.3);
  doc.font('Helvetica').fontSize(6.5).fillColor(LABEL_CLR)
     .text(footerText, ML, PH - 16, { width: CW, align: 'center', lineBreak: false });
}

// ─── Reverso (two-column bilingual terms) ─────────────────────────────────────

function renderReverso(doc: PDFKit.PDFDocument, settings: CompanySettings): void {
  const MT = 22, MB = 22;
  const colW = Math.floor((CW - 14) / 2);
  const col2x = ML + colW + 14;

  const titleY = MT;

  // Column headers
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY)
     .text('CONDICIONES GENERALES DEL CONTRATO', ML, titleY, { width: colW, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY)
     .text('CAR RENTAL CONTRACT', col2x, titleY, { width: colW, lineBreak: false });

  hline(doc, titleY + 14, ML, PW - MR, PRIMARY, 1);

  const contentY = titleY + 20;
  // 95% of page height minus header
  const contentH = Math.floor((PH - MT - MB) * 0.95) - 20;

  const fontSize = Math.max(5.5, Math.min(9, settings.contractBackFontSize ?? 7));
  const type = settings.contractBackContentType ?? 'TEXT';

  function stripHtml(s: string): string {
    return s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  let esContent = settings.contractBackContentEs ?? settings.contractBackContent ?? '';
  let enContent = settings.contractBackContentEn ?? '';

  if (type === 'HTML') {
    esContent = stripHtml(esContent);
    enContent = stripHtml(enContent);
  }

  // Vertical divider
  const divX = ML + colW + 7;
  doc.save()
     .moveTo(divX, contentY - 4).lineTo(divX, contentY + contentH)
     .strokeColor(BORDER_CLR).lineWidth(0.4).stroke()
     .restore();

  // ES column
  if (esContent) {
    doc.font('Helvetica').fontSize(fontSize).fillColor(TXT_CLR)
       .text(esContent, ML, contentY, { width: colW, height: contentH, align: 'justify', lineBreak: true });
  } else {
    doc.font('Helvetica').fontSize(8).fillColor(LABEL_CLR)
       .text('Configura el contenido del reverso en Gestor → Empresa → Contenido reverso contrato.', ML, contentY, { width: colW });
  }

  // EN column
  if (enContent) {
    doc.font('Helvetica').fontSize(fontSize).fillColor(TXT_CLR)
       .text(enContent, col2x, contentY, { width: colW, height: contentH, align: 'justify', lineBreak: true });
  } else {
    doc.font('Helvetica').fontSize(8).fillColor(LABEL_CLR)
       .text('Add English content in Settings → Company → Contract back content (EN).', col2x, contentY, { width: colW });
  }
}

// ─── Public builders ──────────────────────────────────────────────────────────

export function buildContractPdf(data: ContractPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const lang = data.language ?? 'es';
      const tr = strings(lang);
      const doc = new PDFDocument({
        size: 'A4', margin: 0, autoFirstPage: true,
        info: {
          Title:  data.contract?.number ?? 'Contrato',
          Author: data.settings.documentName ?? data.settings.name ?? 'RentIQ',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      renderAnverso(doc, data, tr.copyCompany, false);
      doc.addPage();
      renderReverso(doc, data.settings);
      doc.addPage();
      renderAnverso(doc, data, tr.copyClient, false);
      doc.addPage();
      renderReverso(doc, data.settings);

      doc.end();
    } catch (err) { reject(err); }
  });
}

export function buildBlankContractPdf(settings: CompanySettings, lang: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const tr = strings(lang);
      const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end',  () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const blank: ContractPdfData = {
        contract: {} as Contract,
        client: null, vehicle: null, model: null, category: null, branch: null,
        settings, language: lang,
      };

      renderAnverso(doc, blank, tr.copyCompany, true);
      doc.addPage();
      renderReverso(doc, settings);
      doc.addPage();
      renderAnverso(doc, blank, tr.copyClient, true);
      doc.addPage();
      renderReverso(doc, settings);

      doc.end();
    } catch (err) { reject(err); }
  });
}
