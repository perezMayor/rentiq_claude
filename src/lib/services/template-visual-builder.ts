export type VisualTemplateType = 'CONFIRMACION_RESERVA' | 'PRESUPUESTO' | 'FACTURA';

export type VisualTemplateConfig = {
  title: string;
  intro: string;
  footer: string;
  additionalText: string;
  showContractNumber: boolean;
  showCompany: boolean;
  showReservationBlock: boolean;
  showBaseData: boolean;
  showPricingBlock: boolean;
  showExtrasTable: boolean;
  showObservations: boolean;
  showAdditionalText: boolean;
};

const VISUAL_TEMPLATE_MARKER = 'data-rentiq-visual-template';

export function defaultVisualTemplateConfig(type: VisualTemplateType, language: string): VisualTemplateConfig {
  const isEn = language.toLowerCase().startsWith('en');

  const titles: Record<VisualTemplateType, string> = {
    CONFIRMACION_RESERVA: isEn ? 'Booking Confirmation' : 'Confirmación de reserva',
    PRESUPUESTO: isEn ? 'Rental Quotation' : 'Presupuesto de alquiler',
    FACTURA: isEn ? 'Invoice' : 'Factura',
  };

  const intros: Record<VisualTemplateType, string> = {
    CONFIRMACION_RESERVA: isEn
      ? 'Dear {customer_first_name}, please find below the details of your confirmed reservation.'
      : 'Estimado/a {customer_first_name}, a continuación encontrará los detalles de su reserva confirmada.',
    PRESUPUESTO: isEn
      ? 'Please find below the quotation for your vehicle rental.'
      : 'A continuación le presentamos el presupuesto para su alquiler de vehículo.',
    FACTURA: isEn
      ? 'Please find attached your invoice for services rendered.'
      : 'Adjunto encontrará su factura por los servicios prestados.',
  };

  return {
    title: titles[type],
    intro: intros[type],
    footer: '{company_document_footer}',
    additionalText: '',
    showContractNumber: false,
    showCompany: true,
    showReservationBlock: true,
    showBaseData: true,
    showPricingBlock: true,
    showExtrasTable: true,
    showObservations: true,
    showAdditionalText: false,
  };
}

export function decodeVisualTemplateConfig(htmlContent: string): { templateType: VisualTemplateType; config: VisualTemplateConfig } | null {
  if (!htmlContent.includes(VISUAL_TEMPLATE_MARKER)) return null;
  try {
    const match = htmlContent.match(/data-rentiq-visual-config="([^"]+)"/);
    if (!match) return null;
    const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
    return JSON.parse(decoded) as { templateType: VisualTemplateType; config: VisualTemplateConfig };
  } catch {
    return null;
  }
}

export function buildVisualTemplateHtml(
  type: VisualTemplateType,
  language: string,
  config: VisualTemplateConfig,
  brand: { primaryColor?: string; secondaryColor?: string } = {},
): string {
  const primary = brand.primaryColor || '#2563eb';
  const secondary = brand.secondaryColor || '#0f172a';
  const isEn = language.toLowerCase().startsWith('en');

  const configJson = Buffer.from(JSON.stringify({ templateType: type, config })).toString('base64');

  const labels = {
    reservationNumber: isEn ? 'Booking ref.' : 'Nº reserva',
    deliveryDate: isEn ? 'Pick-up date' : 'Fecha entrega',
    deliveryPlace: isEn ? 'Pick-up location' : 'Lugar entrega',
    deliveryFlight: isEn ? 'Arrival flight' : 'Vuelo llegada',
    returnDate: isEn ? 'Return date' : 'Fecha recogida',
    returnPlace: isEn ? 'Return location' : 'Lugar recogida',
    returnFlight: isEn ? 'Departure flight' : 'Vuelo salida',
    carGroup: isEn ? 'Vehicle group' : 'Grupo vehículo',
    plate: isEn ? 'Plate' : 'Matrícula',
    days: isEn ? 'Days' : 'Días',
    rate: isEn ? 'Rate' : 'Tarifa',
    baseAmount: isEn ? 'Base amount' : 'Importe base',
    discount: isEn ? 'Discount' : 'Descuento',
    insurance: isEn ? 'Insurance' : 'Seguro',
    extras: isEn ? 'Extras' : 'Extras',
    fuel: isEn ? 'Fuel' : 'Combustible',
    total: isEn ? 'TOTAL' : 'TOTAL',
    observations: isEn ? 'Observations' : 'Observaciones',
    deductible: isEn ? 'Deductible' : 'Franquicia',
    deposit: isEn ? 'Deposit' : 'Depósito',
    invoiceNumber: isEn ? 'Invoice no.' : 'Nº factura',
    issuedAt: isEn ? 'Issue date' : 'Fecha emisión',
    contractNumber: isEn ? 'Contract no.' : 'Nº contrato',
    customerName: isEn ? 'Customer' : 'Cliente',
    customerTaxId: isEn ? 'ID / Tax ID' : 'NIF / DNI',
    rentalPeriod: isEn ? 'Rental period' : 'Periodo de alquiler',
    vehicle: isEn ? 'Vehicle' : 'Vehículo',
    subtotal: isEn ? 'Subtotal' : 'Subtotal',
    iva: isEn ? 'VAT ({iva_percent}%)' : 'IVA ({iva_percent}%)',
    penalties: isEn ? 'Penalties' : 'Penalizaciones',
    quotationRef: isEn ? 'Quotation' : 'Presupuesto',
  };

  const commonStyles = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
      .doc-wrap { max-width: 800px; margin: 0 auto; padding: 32px 28px; }
      .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${primary}; padding-bottom: 18px; margin-bottom: 24px; }
      .doc-logo img { max-height: 56px; max-width: 180px; object-fit: contain; }
      .doc-logo-name { font-size: 22px; font-weight: 700; color: ${secondary}; }
      .doc-company-info { text-align: right; font-size: 11px; color: #64748b; line-height: 1.6; }
      .doc-title { font-size: 20px; font-weight: 700; color: ${primary}; margin-bottom: 4px; }
      .doc-intro { font-size: 13px; color: #475569; margin-bottom: 24px; line-height: 1.6; }
      .doc-section { margin-bottom: 20px; }
      .doc-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${primary}; letter-spacing: 0.08em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px; }
      .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
      .doc-field { display: flex; flex-direction: column; }
      .doc-field-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
      .doc-field-value { font-size: 13px; color: #1e293b; font-weight: 500; }
      .doc-pricing-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .doc-pricing-table th { background: ${primary}; color: #fff; font-size: 11px; font-weight: 600; padding: 7px 10px; text-align: left; }
      .doc-pricing-table td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
      .doc-pricing-table tr:last-child td { border-bottom: none; }
      .doc-pricing-table .total-row td { font-weight: 700; font-size: 15px; color: ${secondary}; background: #f1f5f9; }
      .doc-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6; }
      .doc-observations { background: #f8fafc; border-left: 3px solid ${primary}; padding: 10px 14px; font-size: 12px; color: #475569; border-radius: 0 4px 4px 0; }
      .doc-additional { margin-top: 12px; font-size: 12px; color: #475569; line-height: 1.6; }
      @media print { body { font-size: 11px; } .doc-wrap { padding: 16px; } }
    </style>
  `;

  const companyBlock = config.showCompany ? `
    <div class="doc-company-info">
      {company_tax_id}<br>
      {company_fiscal_address}<br>
      {company_phone} &nbsp;·&nbsp; {company_email_from}
    </div>
  ` : '<div></div>';

  const logoSection = `
    <div class="doc-logo">
      <img src="{company_logo_data_url}" alt="{company_document_name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
      <div class="doc-logo-name" style="display:none">{company_document_name}</div>
    </div>
  `;

  if (type === 'CONFIRMACION_RESERVA') {
    const reservationBlock = config.showReservationBlock ? `
      <div class="doc-section">
        <div class="doc-section-title">${isEn ? 'Reservation details' : 'Detalles de la reserva'}</div>
        <div class="doc-grid">
          <div class="doc-field">
            <span class="doc-field-label">${labels.reservationNumber}</span>
            <span class="doc-field-value">{reservation_number}</span>
          </div>
          ${config.showContractNumber ? `<div class="doc-field"><span class="doc-field-label">${isEn ? 'Contract no.' : 'Nº contrato'}</span><span class="doc-field-value">{contract_number}</span></div>` : '<div></div>'}
          <div class="doc-field">
            <span class="doc-field-label">${labels.deliveryDate}</span>
            <span class="doc-field-value">{delivery_date} {delivery_time}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.deliveryPlace}</span>
            <span class="doc-field-value">{delivery_place}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.deliveryFlight}</span>
            <span class="doc-field-value">{delivery_flight}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.returnDate}</span>
            <span class="doc-field-value">{pickup_date} {pickup_time}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.returnPlace}</span>
            <span class="doc-field-value">{pickup_place}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.returnFlight}</span>
            <span class="doc-field-value">{pickup_flight}</span>
          </div>
        </div>
      </div>
    ` : '';

    const baseDataBlock = config.showBaseData ? `
      <div class="doc-section">
        <div class="doc-section-title">${isEn ? 'Vehicle & rate' : 'Vehículo y tarifa'}</div>
        <div class="doc-grid">
          <div class="doc-field">
            <span class="doc-field-label">${labels.carGroup}</span>
            <span class="doc-field-value">{billed_car_group}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.plate}</span>
            <span class="doc-field-value">{assigned_plate}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.days}</span>
            <span class="doc-field-value">{billed_days}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.rate}</span>
            <span class="doc-field-value">{applied_rate}</span>
          </div>
        </div>
      </div>
    ` : '';

    const pricingBlock = config.showPricingBlock ? `
      <div class="doc-section">
        <div class="doc-section-title">${isEn ? 'Price breakdown' : 'Desglose de precio'}</div>
        <table class="doc-pricing-table">
          <thead><tr><th>${isEn ? 'Concept' : 'Concepto'}</th><th style="text-align:right">${isEn ? 'Amount' : 'Importe'}</th></tr></thead>
          <tbody>
            <tr><td>${labels.baseAmount}</td><td style="text-align:right">{base_amount} €</td></tr>
            <tr><td>${labels.insurance}</td><td style="text-align:right">{insurance_amount} €</td></tr>
            <tr><td>${labels.extras}</td><td style="text-align:right">{extras_amount} €</td></tr>
            <tr><td>${labels.fuel}</td><td style="text-align:right">{fuel_amount} €</td></tr>
            <tr><td>${labels.discount} (−)</td><td style="text-align:right">{discount_amount} €</td></tr>
            <tr class="total-row"><td>${labels.total}</td><td style="text-align:right">{total_price} €</td></tr>
          </tbody>
        </table>
      </div>
    ` : '';

    const extrasBlock = config.showExtrasTable ? `
      <div class="doc-section">
        <div class="doc-section-title">${isEn ? 'Additional info' : 'Información adicional'}</div>
        <div class="doc-grid">
          <div class="doc-field">
            <span class="doc-field-label">${labels.deductible}</span>
            <span class="doc-field-value">{deductible} €</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.deposit}</span>
            <span class="doc-field-value">{deposit_amount} €</span>
          </div>
        </div>
      </div>
    ` : '';

    const observationsBlock = config.showObservations ? `
      <div class="doc-section">
        <div class="doc-observations">{public_observations}</div>
      </div>
    ` : '';

    const additionalBlock = config.showAdditionalText && config.additionalText ? `
      <div class="doc-additional">${config.additionalText}</div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="${language}" ${VISUAL_TEMPLATE_MARKER} data-rentiq-visual-config="${configJson}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${commonStyles}</head>
<body>
<div class="doc-wrap">
  <div class="doc-header">
    ${logoSection}
    ${companyBlock}
  </div>
  <div class="doc-title">${config.title}</div>
  <p class="doc-intro">${config.intro}</p>
  ${reservationBlock}
  ${baseDataBlock}
  ${pricingBlock}
  ${extrasBlock}
  ${observationsBlock}
  ${additionalBlock}
  <div class="doc-footer">${config.footer}</div>
</div>
</body></html>`;
  }

  if (type === 'PRESUPUESTO') {
    const reservationBlock = config.showReservationBlock ? `
      <div class="doc-section">
        <div class="doc-section-title">${isEn ? 'Rental details' : 'Detalles del alquiler'}</div>
        <div class="doc-grid">
          <div class="doc-field">
            <span class="doc-field-label">${labels.deliveryDate}</span>
            <span class="doc-field-value">{delivery_date} {delivery_time}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.deliveryPlace}</span>
            <span class="doc-field-value">{delivery_place}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.returnDate}</span>
            <span class="doc-field-value">{pickup_date} {pickup_time}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.returnPlace}</span>
            <span class="doc-field-value">{pickup_place}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.carGroup}</span>
            <span class="doc-field-value">{billed_car_group}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.days}</span>
            <span class="doc-field-value">{billed_days}</span>
          </div>
          <div class="doc-field">
            <span class="doc-field-label">${labels.rate}</span>
            <span class="doc-field-value">{applied_rate}</span>
          </div>
        </div>
      </div>
    ` : '';

    const pricingBlock = config.showPricingBlock ? `
      <div class="doc-section">
        <div class="doc-section-title">${isEn ? 'Price breakdown' : 'Desglose de precio'}</div>
        <table class="doc-pricing-table">
          <thead><tr><th>${isEn ? 'Concept' : 'Concepto'}</th><th style="text-align:right">${isEn ? 'Amount' : 'Importe'}</th></tr></thead>
          <tbody>
            <tr><td>${labels.baseAmount}</td><td style="text-align:right">{base_amount} €</td></tr>
            <tr><td>${labels.insurance}</td><td style="text-align:right">{insurance_amount} €</td></tr>
            <tr><td>${labels.extras}</td><td style="text-align:right">{extras_amount} €</td></tr>
            <tr><td>${labels.fuel}</td><td style="text-align:right">{fuel_amount} €</td></tr>
            <tr><td>${labels.discount} (−)</td><td style="text-align:right">{discount_amount} €</td></tr>
            <tr class="total-row"><td>${labels.total}</td><td style="text-align:right">{total_amount} €</td></tr>
          </tbody>
        </table>
      </div>
    ` : '';

    const additionalBlock = config.showAdditionalText && config.additionalText ? `
      <div class="doc-additional">${config.additionalText}</div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="${language}" ${VISUAL_TEMPLATE_MARKER} data-rentiq-visual-config="${configJson}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${commonStyles}</head>
<body>
<div class="doc-wrap">
  <div class="doc-header">
    ${logoSection}
    ${companyBlock}
  </div>
  <div class="doc-title">${config.title}</div>
  <p class="doc-intro">${config.intro}</p>
  ${reservationBlock}
  ${pricingBlock}
  ${additionalBlock}
  <div class="doc-footer">${config.footer}</div>
</div>
</body></html>`;
  }

  // FACTURA
  const baseDataBlock = config.showBaseData ? `
    <div class="doc-section">
      <div class="doc-section-title">${isEn ? 'Invoice details' : 'Datos de la factura'}</div>
      <div class="doc-grid">
        <div class="doc-field">
          <span class="doc-field-label">${labels.invoiceNumber}</span>
          <span class="doc-field-value">{invoice_number}</span>
        </div>
        <div class="doc-field">
          <span class="doc-field-label">${labels.issuedAt}</span>
          <span class="doc-field-value">{issued_at}</span>
        </div>
        <div class="doc-field">
          <span class="doc-field-label">${labels.contractNumber}</span>
          <span class="doc-field-value">{contract_number}</span>
        </div>
        <div class="doc-field">
          <span class="doc-field-label">${labels.rentalPeriod}</span>
          <span class="doc-field-value">{rental_period_detail}</span>
        </div>
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">${isEn ? 'Customer' : 'Datos del cliente'}</div>
      <div class="doc-grid">
        <div class="doc-field">
          <span class="doc-field-label">${labels.customerName}</span>
          <span class="doc-field-value">{customer_name}</span>
        </div>
        <div class="doc-field">
          <span class="doc-field-label">${labels.customerTaxId}</span>
          <span class="doc-field-value">{customer_tax_id}</span>
        </div>
        <div class="doc-field">
          <span class="doc-field-label">${isEn ? 'Address' : 'Dirección'}</span>
          <span class="doc-field-value">{customer_address}</span>
        </div>
        <div class="doc-field">
          <span class="doc-field-label">Email</span>
          <span class="doc-field-value">{customer_email}</span>
        </div>
      </div>
    </div>
  ` : '';

  const pricingBlock = config.showPricingBlock ? `
    <div class="doc-section">
      <div class="doc-section-title">${isEn ? 'Billing summary' : 'Resumen de facturación'}</div>
      <table class="doc-pricing-table">
        <thead><tr><th>${isEn ? 'Concept' : 'Concepto'}</th><th style="text-align:right">${isEn ? 'Amount' : 'Importe'}</th></tr></thead>
        <tbody>
          <tr><td>${labels.subtotal} (${isEn ? 'vehicle occupation' : 'ocupación vehículo'})</td><td style="text-align:right">{vehicle_occupation_amount} €</td></tr>
          <tr><td>${labels.extras}</td><td style="text-align:right">{extras_amount} €</td></tr>
          <tr><td>${labels.insurance}</td><td style="text-align:right">{insurance_amount} €</td></tr>
          <tr><td>${labels.fuel}</td><td style="text-align:right">{fuel_amount} €</td></tr>
          <tr><td>${labels.penalties}</td><td style="text-align:right">{penalties_amount} €</td></tr>
          <tr><td>${labels.discount} (−)</td><td style="text-align:right">{discount_amount} €</td></tr>
          <tr><td>${labels.subtotal}</td><td style="text-align:right">{base_amount} €</td></tr>
          <tr><td>${labels.iva}</td><td style="text-align:right">{iva_amount} €</td></tr>
          <tr class="total-row"><td>${labels.total}</td><td style="text-align:right">{total_amount} €</td></tr>
        </tbody>
      </table>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="${language}" ${VISUAL_TEMPLATE_MARKER} data-rentiq-visual-config="${configJson}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">${commonStyles}</head>
<body>
<div class="doc-wrap">
  <div class="doc-header">
    ${logoSection}
    ${companyBlock}
  </div>
  <div class="doc-title">${config.title}</div>
  <p class="doc-intro">${config.intro}</p>
  ${baseDataBlock}
  ${pricingBlock}
  <div class="doc-footer">${config.footer}</div>
</div>
</body></html>`;
}
