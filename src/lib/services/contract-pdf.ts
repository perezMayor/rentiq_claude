// contract-pdf.ts — PDFKit contract builder (2 copies × anverso + reverso)

import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import type {
  Contract, Client, FleetVehicle, VehicleModel,
  VehicleCategory, CompanySettings, CompanyBranch,
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

// ─── Layout ───────────────────────────────────────────────────────────────────

const PW  = 595;
const PH  = 842;
const ML  = 30;
const MR  = 30;
const CW  = PW - ML - MR;   // 535

const C1W  = 249;
const CGAP = 17;
const C2W  = CW - C1W - CGAP;  // 269
const C2X  = ML + C1W + CGAP;

// ─── Colors ───────────────────────────────────────────────────────────────────

const PRIMARY    = '#2b6cbd';
const BORDER_CLR = '#d1d5db';
const LABEL_CLR  = '#6b7280';
const TXT_CLR    = '#111827';
const SUBHDR_BG  = '#f3f4f6';
const SUBHDR_CLR = '#9ca3af';
const TOTAL_BG   = '#eff6ff';

// ─── i18n ─────────────────────────────────────────────────────────────────────

function str(lang: string) {
  const en = lang.startsWith('en');
  return {
    titleDoc:       en ? 'Car Rental Contract'              : 'Contrato de alquiler',
    copyCompany:    en ? 'COMPANY COPY'                     : 'COPIA EMPRESA',
    copyClient:     en ? 'CLIENT COPY'                      : 'COPIA CLIENTE',
    contractNo:     en ? 'No.'                              : 'Nº',
    vehicleData:    en ? 'Vehicle data'                     : 'Datos del vehículo',
    brandModel:     en ? 'Make / Model'                     : 'Marca / modelo',
    plate:          en ? 'Plate'                            : 'Matrícula',
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
    vacationAddr:   en ? 'Vacation / holiday address'       : 'Dirección de vacaciones',
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
    vehicleCondition: en ? 'KM & fuel'                      : 'KM y combustible',
    kmOut:          en ? 'KM out'                           : 'KM salida',
    kmIn:           en ? 'KM in'                            : 'KM entrada',
    fuelOut:        en ? 'Fuel out'                         : 'Combustible salida',
    fuelIn:         en ? 'Fuel in'                          : 'Combustible entrada',
    observations:   en ? 'Observations'                     : 'Observaciones',
    noObs:          en ? 'No observations'                  : 'Sin observaciones',
    sigTextEs:      'He leído y entiendo los términos y condiciones del presente contrato de alquiler y autorizo con mi firma que todos los importes derivados de este alquiler sean cargados en mi tarjeta de crédito.',
    sigTextEn:      'I have read and agreed the terms of this rental agreement and I authorize with my signature that all amounts derived from this rent are charged to my credit card, deposit or others.',
    sigRenter:      en ? 'Renter signature'                 : 'Firma arrendatario',
    sigCompany:     en ? 'Company signature'                : 'Firma empresa',
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

function fmtAmt(n: number): string { return (n ?? 0).toFixed(2); }

function blankLine(n = 20): string { return '_'.repeat(n); }

function fuelStr(fuel: string | undefined, lang: string): string {
  if (!fuel) return 'N/D';
  return lang.startsWith('en')
    ? ({ GASOLINA: 'Petrol', DIESEL: 'Diesel', ELECTRICO: 'Electric', HIBRIDO: 'Hybrid' }[fuel] ?? fuel)
    : ({ GASOLINA: 'Gasolina', DIESEL: 'Diésel', ELECTRICO: 'Eléctrico', HIBRIDO: 'Híbrido' }[fuel] ?? fuel);
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function hline(doc: PDFKit.PDFDocument, y: number, x1 = ML, x2 = PW - MR, color = BORDER_CLR, lw = 0.5) {
  doc.save().moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(lw).stroke().restore();
}

function vline(doc: PDFKit.PDFDocument, x: number, y1: number, y2: number, color = BORDER_CLR, lw = 0.3) {
  doc.save().moveTo(x, y1).lineTo(x, y2).strokeColor(color).lineWidth(lw).stroke().restore();
}

// Bordered section box with blue title — returns innerY
function secBox(doc: PDFKit.PDFDocument, title: string, x: number, y: number, w: number, h: number): number {
  doc.save().roundedRect(x, y, w, h, 2).strokeColor(BORDER_CLR).lineWidth(0.5).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY)
     .text(title, x + 7, y + 6, { width: w - 14, lineBreak: false });
  hline(doc, y + 17, x + 2, x + w - 2, BORDER_CLR, 0.3);
  return y + 20;
}

// Stacked label + value
function field(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, w: number) {
  doc.font('Helvetica').fontSize(6).fillColor(LABEL_CLR)
     .text(label, x, y, { width: w, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
     .text(value || 'N/D', x, y + 7, { width: w, lineBreak: false, ellipsis: true });
}

// Gray subheader stripe
function subHdr(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number): number {
  doc.save().rect(x, y, w, 11).fillColor(SUBHDR_BG).fill().restore();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(SUBHDR_CLR)
     .text(text, x + 4, y + 2, { width: w - 8, lineBreak: false, align: 'center' });
  return y + 13;
}

// ─── Car silhouette image ─────────────────────────────────────────────────────

// Cached buffer so we only read disk once per process lifetime
let _siluetaBuffer: Buffer | null | undefined = undefined;
function getSilueta(): Buffer | null {
  if (_siluetaBuffer !== undefined) return _siluetaBuffer;
  try {
    _siluetaBuffer = fs.readFileSync(path.join(process.cwd(), 'public/brand/silueta.png'));
  } catch {
    _siluetaBuffer = null;
  }
  return _siluetaBuffer;
}

function drawCarSide(doc: PDFKit.PDFDocument, bx: number, by: number, bw: number, bh: number) {
  const buf = getSilueta();
  if (!buf) return;
  // Fill 90 % of the bounding box, preserving aspect ratio, centred
  const aspect = 1916 / 1228;
  const tW = bw * 0.90, tH = bh * 0.90;
  let iw = tW, ih = tW / aspect;
  if (ih > tH) { ih = tH; iw = tH * aspect; }
  const ix = bx + (bw - iw) / 2;
  const iy = by + (bh - ih) / 2;
  try { doc.image(buf, ix, iy, { width: iw, height: ih }); } catch { /* skip */ }
}

// ─── Header ───────────────────────────────────────────────────────────────────

function drawHeader(
  doc: PDFKit.PDFDocument,
  settings: CompanySettings,
  contractNum: string,
  copyLabel: string,
  lang: string,
): number {
  const tr = str(lang);
  let y = 22;

  // Logo (left)
  let logoW = 0;
  if (settings.logoDataUrl) {
    try {
      const b64 = settings.logoDataUrl.replace(/^data:image\/\w+;base64,/, '');
      doc.image(Buffer.from(b64, 'base64'), ML, y, { height: 44, fit: [100, 44] });
      logoW = 108;
    } catch { /* skip */ }
  }

  // Contract no. + badge block (right, fixed 115pt wide)
  const rightBlockW = 115;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TXT_CLR)
     .text(`${tr.contractNo} ${contractNum}`, PW - MR - rightBlockW, y + 2, {
       width: rightBlockW, align: 'right', lineBreak: false,
     });
  const badgeY = y + 18;
  doc.save().roundedRect(PW - MR - rightBlockW, badgeY, rightBlockW, 15, 3)
     .fillColor(PRIMARY).fill().restore();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('white')
     .text(copyLabel, PW - MR - rightBlockW, badgeY + 4, {
       width: rightBlockW, align: 'center', lineBreak: false,
     });

  // Company block (between logo and right block), perfectly centred
  const cx  = ML + logoW;
  const cw  = CW - logoW - rightBlockW - 6;
  const name = settings.documentName ?? settings.name ?? '';
  const nif  = settings.taxId ?? settings.nif ?? '';
  const addr = settings.fiscalAddress ?? settings.address ?? '';
  const phone = settings.companyPhone ?? settings.phone ?? '';

  doc.font('Helvetica-Bold').fontSize(11).fillColor(TXT_CLR)
     .text(name, cx, y + 2, { width: cw, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text([nif, addr, phone].filter(Boolean).join('  ·  '), cx, y + 16, {
       width: cw, lineBreak: false, ellipsis: true,
     });

  y = 74;
  hline(doc, y, ML, PW - MR, PRIMARY, 1.5);
  y += 8;

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
  const tr = str(lang);
  const v = (val: string | number | undefined | null, fb = 'N/D'): string =>
    isBlank ? blankLine() : (val != null && String(val).trim() !== '' ? String(val) : fb);

  let y = drawHeader(doc, settings, isBlank ? '' : (contract?.number ?? ''), copyLabel, lang);

  // ── Vehicle data (full width) ─────────────────────────────────────────────

  const VH = 50;
  const VIW = CW - 14;  // inner usable width (7px padding each side)
  const vInner = secBox(doc, tr.vehicleData, ML, y, CW, VH);

  const vRatios = [0.30, 0.17, 0.13, 0.13, 0.27];
  const modelStr = model ? `${model.brand} ${model.model}` : '';
  const vFields: [string, string][] = [
    [tr.brandModel,  v(modelStr)],
    [tr.plate,       v(contract?.plate)],
    [tr.color,       v(vehicle?.color)],
    [tr.group,       v(category?.code ?? category?.name)],
    [tr.fuelLabel,   v(fuelStr(model?.fuel, lang))],
  ];
  let vx = ML + 7;
  for (let i = 0; i < vFields.length; i++) {
    const colW = VIW * vRatios[i];
    field(doc, vFields[i][0], vFields[i][1], vx, vInner + 4, colW - 6);
    vx += colW;
    if (i < vFields.length - 1) vline(doc, vx - 2, vInner + 2, y + VH - 3);
  }
  y += VH + 4;

  // ── Row 1: Conductor principal | Datos del alquiler ───────────────────────

  let ly = y, ry = y;

  // LEFT: Conductor principal
  const cpH = 190;
  const cpInner = secBox(doc, tr.mainDriver, ML, ly, C1W, cpH);
  let cpY = cpInner + 3;
  const cHalf = (C1W - 16) / 2;
  const cInner = C1W - 14;  // 235pt usable width

  const clientName = client
    ? `${client.name}${client.surname ? ' ' + client.surname : ''}`
    : '';

  // Row 1: Nombre (52%) | Nacimiento (26%) | Nacionalidad (22%)
  const n1 = cInner * 0.52, n2 = cInner * 0.26;
  field(doc, tr.clientLabel,  v(clientName), ML + 7,           cpY, n1 - 4);
  field(doc, tr.birthDate,    'N/D',         ML + 7 + n1,      cpY, n2 - 4);
  field(doc, tr.nationality,  'N/D',         ML + 7 + n1 + n2, cpY, cInner - n1 - n2 - 2);
  cpY += 18;

  // Row 2: Documento (DNI/Pasaporte) + Caducidad documento — juntos
  field(doc, tr.document,  client?.nif ? `DNI ${client.nif}` : v(undefined), ML + 7, cpY, cHalf);
  field(doc, tr.docExpiry, 'N/D', ML + 7 + cHalf + 4, cpY, cHalf);
  cpY += 18;

  // Row 3: Permiso de conducir + Caducidad permiso — juntos
  field(doc, tr.license,   v(client?.licenseNumber), ML + 7, cpY, cHalf);
  field(doc, tr.licExpiry, client?.licenseExpiry ? fmtDate(client.licenseExpiry, lang) : 'N/D',
        ML + 7 + cHalf + 4, cpY, cHalf);
  cpY += 18;

  // Dirección permanente — permite hasta 2 líneas
  cpY = subHdr(doc, tr.permAddress, ML + 4, cpY, C1W - 8);
  const addrLine = [client?.address, client?.city, client?.country].filter(Boolean).join(', ') || 'N/D';
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
     .text(isBlank ? blankLine(22) : addrLine, ML + 7, cpY, { width: cInner, lineBreak: true, height: 20 });
  cpY = doc.y + 5;

  // Dirección de vacaciones
  cpY = subHdr(doc, tr.vacationAddr, ML + 4, cpY, C1W - 8);
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
     .text(isBlank ? blankLine(22) : 'N/D', ML + 7, cpY, { width: cInner, lineBreak: true, height: 20 });
  cpY = doc.y + 5;

  // Teléfonos
  cpY = subHdr(doc, tr.phones, ML + 4, cpY, C1W - 8);
  field(doc, tr.phoneFix, v(client?.phone), ML + 7, cpY, cHalf);
  field(doc, tr.mobile,   'N/D',            ML + 7 + cHalf + 4, cpY, cHalf);

  ly += cpH + 4;

  // RIGHT: Datos del alquiler — same height as conductor
  const daH = cpH;
  const catCode = category?.code ?? category?.name ?? 'N/D';
  const daInner = secBox(doc, tr.rentalData, C2X, ry, C2W, daH);
  let daY = daInner + 3;
  const rHalf = (C2W - 16) / 2;

  field(doc, tr.pickupLocation, v(contract?.pickupLocation), C2X + 7, daY, rHalf);
  field(doc, tr.returnLocation, v(contract?.returnLocation), C2X + 7 + rHalf + 4, daY, rHalf);
  daY += 20;

  field(doc, tr.deliveryDate, v(contract ? fmtDate(contract.startDate, lang) : undefined), C2X + 7, daY, rHalf);
  field(doc, tr.returnDate,   v(contract ? fmtDate(contract.endDate,   lang) : undefined), C2X + 7 + rHalf + 4, daY, rHalf);
  daY += 20;

  field(doc, tr.deliveryTime, v(contract?.startTime), C2X + 7, daY, rHalf);
  field(doc, tr.returnTime,   v(contract?.endTime),   C2X + 7 + rHalf + 4, daY, rHalf);
  daY += 20;

  field(doc, tr.deliveryFlight, v(data.pickupFlight), C2X + 7, daY, rHalf);
  field(doc, tr.returnFlight,   v(data.returnFlight), C2X + 7 + rHalf + 4, daY, rHalf);
  daY += 20;

  field(doc, tr.totalDays,  v(contract?.billedDays), C2X + 7, daY, rHalf);
  field(doc, tr.tariffCode, 'N/D',                   C2X + 7 + rHalf + 4, daY, rHalf);
  daY += 20;

  field(doc, tr.groupBilled, isBlank ? blankLine(16) : `${catCode} / ${catCode}`, C2X + 7, daY, C2W - 14);

  ry += daH + 4;
  y = Math.max(ly, ry);

  // ── Row 3: (Empresa + Conductores adicionales) | Desglose ────────────────

  ly = y; ry = y;

  // Calculate desglose rows first so both boxes share the same height
  type BRow = [string, number | null, boolean];
  const bRows: BRow[] = isBlank
    ? ([
        [tr.base, null, false], [tr.discount, null, false], [tr.extras, null, false],
        [tr.fuelCharge, null, false], [tr.insurance, null, false], [tr.total, null, true],
      ] as BRow[])
    : ([
        [tr.base,       contract.basePrice,      false],
        [tr.discount,   contract.discount,       false],
        [tr.extras,     contract.extrasTotal,    false],
        [tr.fuelCharge, contract.fuelCharge,     false],
        [tr.insurance,  contract.insuranceTotal, false],
        ...(contract.penalties > 0 ? [[tr.penalties, contract.penalties, false]] as BRow[] : []),
        [tr.total, contract.total, true],
      ] as BRow[]);

  const rowH     = 13;
  const rowsH    = bRows.length * rowH + 20;  // content height
  const francH   = 18;                        // franquicia row below separator
  const emH      = 86;                        // empresa box height
  const caH      = 36;                        // conductores adicionales box height
  const boxH     = Math.max(emH + 4 + caH, rowsH + francH);

  // Empresa box (left top)
  const emInner = secBox(doc, tr.companySection, ML, ly, C1W, emH);
  let emY = emInner + 4;
  const emPairs: [string, string][] = isBlank
    ? [
        [tr.companySection, blankLine(22)],
        [tr.companyCIF,     blankLine(14)],
        [tr.fiscalAddr,     blankLine(22)],
        [tr.contact,        blankLine(22)],
      ]
    : [
        [tr.companySection, settings.documentName ?? settings.name],
        [tr.companyCIF,     settings.taxId ?? settings.nif],
        [tr.fiscalAddr,     settings.fiscalAddress ?? settings.address],
        [tr.contact,        [settings.companyPhone ?? settings.phone, settings.email].filter(Boolean).join('  ·  ')],
      ];
  for (const [lbl, val] of emPairs) {
    field(doc, lbl, val, ML + 7, emY, C1W - 14);
    emY += 14;
  }

  // Conductores adicionales (left, below empresa)
  const caY = ly + emH + 4;
  secBox(doc, tr.addDrivers, ML, caY, C1W, caH);
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(tr.noAddDrivers, ML + 7, caY + 24, { lineBreak: false });

  ly += boxH + 4;

  // Desglose box (right, same total height)
  const deInner = secBox(doc, tr.breakdown, C2X, ry, C2W, boxH);
  let deY = deInner + 4;
  const deLW = C2W * 0.62;
  const deVW = C2W - deLW - 10;

  for (const [lbl, amt, bold] of bRows) {
    const valStr = isBlank ? blankLine(8) : fmtAmt(amt ?? 0);
    if (bold) {
      doc.save().rect(C2X + 2, deY - 2, C2W - 4, rowH + 1).fillColor(TOTAL_BG).fill().restore();
    }
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
       .fillColor(bold ? PRIMARY : LABEL_CLR)
       .text(lbl, C2X + 7, deY, { width: deLW, lineBreak: false });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
       .fillColor(TXT_CLR)
       .text(valStr, C2X + deLW, deY, { width: deVW, align: 'right', lineBreak: false });
    deY += rowH;
  }

  // Franquicia
  deY += 3;
  hline(doc, deY, C2X + 4, C2X + C2W - 4, BORDER_CLR, 0.3);
  deY += 4;
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(tr.franchise, C2X + 7, deY, { width: deLW, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
     .text('N/D', C2X + deLW, deY, { width: deVW, align: 'right', lineBreak: false });

  ry += boxH + 4;
  y = Math.max(ly, ry);

  // ── Row 4: Vehículo (con croquis) | Cambios + KM/Fuel + Observaciones ─────

  ly = y; ry = y;

  // Right height = 3 boxes stacked
  const chH  = 36;
  const kmH  = 65;
  const obsH = 73;
  const vehH = chH + 4 + kmH + 4 + obsH;   // left matches combined right height

  // Left: Vehículo + car sketch
  const vehInner = secBox(doc, tr.vehicleSection, ML, ly, C1W, vehH);
  drawCarSide(doc, ML + 4, vehInner + 2, C1W - 8, vehH - (vehInner - ly) - 4);
  ly += vehH + 4;

  // Right — KM y combustible (primero)
  const kmInner = secBox(doc, tr.vehicleCondition, C2X, ry, C2W, kmH);
  let kmY = kmInner + 3;
  const kHalf = (C2W - 16) / 2;
  field(doc, tr.kmOut,   isBlank ? blankLine(8) : 'N/D', C2X + 7,             kmY, kHalf);
  field(doc, tr.kmIn,    isBlank ? blankLine(8) : 'N/D', C2X + 7 + kHalf + 4, kmY, kHalf);
  kmY += 20;
  field(doc, tr.fuelOut, isBlank ? blankLine(8) : 'N/D', C2X + 7,             kmY, kHalf);
  field(doc, tr.fuelIn,  isBlank ? blankLine(8) : 'N/D', C2X + 7 + kHalf + 4, kmY, kHalf);
  ry += kmH + 4;

  // Right — Cambios de vehículo
  secBox(doc, tr.vehicleChanges, C2X, ry, C2W, chH);
  doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
     .text(tr.noChanges, C2X + 7, ry + 22, { lineBreak: false });
  ry += chH + 4;

  // Right — Observaciones
  const obsInner = secBox(doc, tr.observations, C2X, ry, C2W, obsH);
  const obsText  = isBlank ? '' : (contract?.notes ?? '');
  if (obsText) {
    doc.font('Helvetica').fontSize(7.5).fillColor(TXT_CLR)
       .text(obsText, C2X + 7, obsInner + 2, { width: C2W - 14, height: obsH - 10, lineBreak: true });
  } else {
    doc.font('Helvetica').fontSize(7.5).fillColor(LABEL_CLR)
       .text(tr.noObs, C2X + 7, obsInner + 4, { lineBreak: false });
  }
  ry += obsH + 4;

  y = Math.max(ly, ry) + 4;

  // ── Signature section ──────────────────────────────────────────────────────

  hline(doc, y, ML, PW - MR, BORDER_CLR, 0.5);
  y += 6;

  doc.font('Helvetica').fontSize(7).fillColor(TXT_CLR)
     .text(str('es').sigTextEs, ML, y, { width: CW, lineBreak: true });
  y = doc.y + 3;
  doc.font('Helvetica').fontSize(6.5).fillColor(LABEL_CLR)
     .text('* ' + str('en').sigTextEn, ML, y, { width: CW, lineBreak: true });
  y = doc.y + 6;

  const sigW = CW / 2 - 8;
  const sigH = Math.max(50, PH - 28 - y);

  doc.save().roundedRect(ML, y, sigW, sigH, 2).strokeColor(BORDER_CLR).lineWidth(0.5).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TXT_CLR)
     .text(tr.sigRenter, ML + 7, y + 5, { lineBreak: false });

  const sx2 = ML + sigW + 16;
  doc.save().roundedRect(sx2, y, sigW, sigH, 2).strokeColor(BORDER_CLR).lineWidth(0.5).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TXT_CLR)
     .text(tr.sigCompany, sx2 + 7, y + 5, { lineBreak: false });

  // Embed digital signature if present
  if (!isBlank && contract?.checkout?.signatureUrl) {
    try {
      const b64 = contract.checkout.signatureUrl.replace(/^data:image\/\w+;base64,/, '');
      doc.image(Buffer.from(b64, 'base64'), ML + 4, y + 14, { height: 24, fit: [sigW - 10, 24] });
    } catch { /* ignore */ }
  }

  // Footer
  const footerText = settings.documentFooter
    ?? [settings.documentName ?? settings.name ?? '', settings.fiscalAddress ?? settings.address ?? '']
       .filter(Boolean).join('  ·  ');

  hline(doc, PH - 22, ML, PW - MR, BORDER_CLR, 0.3);
  doc.font('Helvetica').fontSize(6.5).fillColor(LABEL_CLR)
     .text(footerText, ML, PH - 16, { width: CW, align: 'center', lineBreak: false });
}

// ─── Reverso (two-column bilingual) ───────────────────────────────────────────

function renderReverso(doc: PDFKit.PDFDocument, settings: CompanySettings): void {
  const MT  = 22;
  const MB  = 22;
  const colW = Math.floor((CW - 14) / 2);
  const col2x = ML + colW + 14;
  const divX  = ML + colW + 7;

  // Column headers
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY)
     .text('CONDICIONES GENERALES DEL CONTRATO', ML, MT, { width: colW, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PRIMARY)
     .text('CAR RENTAL CONTRACT', col2x, MT, { width: colW, lineBreak: false });

  hline(doc, MT + 14, ML, PW - MR, PRIMARY, 1);

  const contentY = MT + 20;
  const contentH = Math.floor((PH - MT - MB) * 0.95) - 20;

  const fontSize = Math.max(5.5, Math.min(9, settings.contractBackFontSize ?? 7));
  const type     = settings.contractBackContentType ?? 'TEXT';

  function stripHtml(s: string): string {
    return s
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  let esContent = settings.contractBackContentEs ?? settings.contractBackContent ?? '';
  let enContent = settings.contractBackContentEn ?? '';
  if (type === 'HTML') { esContent = stripHtml(esContent); enContent = stripHtml(enContent); }

  // Vertical divider
  doc.save().moveTo(divX, contentY - 4).lineTo(divX, contentY + contentH)
     .strokeColor(BORDER_CLR).lineWidth(0.4).stroke().restore();

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
      const tr   = str(lang);
      const doc  = new PDFDocument({
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
      const tr  = str(lang);
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
