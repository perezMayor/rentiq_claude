export function renderTemplateWithMacros(html: string, data: Record<string, string | number | undefined | null>): string {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    const macro = `{${key}}`;
    result = result.split(macro).join(String(value ?? ''));
  }
  return result;
}

type CompanyData = {
  name: string;
  taxId: string;
  fiscalAddress: string;
  emailFrom: string;
  phone: string;
  website: string;
  footer: string;
  logoDataUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
};

type CustomerData = {
  id: string;
  firstName: string;
  lastName1: string;
  lastName2: string;
  email: string;
  phone1: string;
  taxId: string;
  documentType: string;
  documentNumber: string;
  drivingLicenseNumber: string;
  street: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  nationality: string;
  // allow extra fields
  [key: string]: unknown;
};

type ReservationData = {
  reservationNumber: string;
  reservationStatus: string;
  branchDelivery: string;
  deliveryPlace: string;
  deliveryAt: string;
  pickupBranch: string;
  pickupPlace: string;
  pickupAt: string;
  deliveryFlightNumber: string;
  pickupFlightNumber: string;
  billedCarGroup: string;
  assignedPlate: string;
  billedDays: number;
  appliedRate: string;
  baseAmount: number;
  extrasAmount: number;
  insuranceAmount: number;
  fuelAmount: number;
  discountAmount: number;
  totalPrice: number;
  extrasBreakdown: string;
  deductible: string;
  depositAmount: number;
  publicObservations: string;
  paymentsMade: number;
  ivaPercent: number;
  [key: string]: unknown;
};

type BudgetData = {
  deliveryAt: string;
  deliveryPlace: string;
  pickupAt: string;
  pickupPlace: string;
  billedCarGroup: string;
  billedDays: number;
  appliedRate: string;
  baseAmount: number;
  discountAmount: number;
  insuranceAmount: number;
  extrasAmount: number;
  fuelAmount: number;
  totalAmount: number;
  extrasBreakdown: string;
};

function formatDate(isoDate: string, language: string): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    const locale = language.startsWith('en') ? 'en-GB' : 'es-ES';
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

function formatTime(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatAmount(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(n)) return '0,00';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildReservationTemplateData(input: {
  language: string;
  company: CompanyData;
  customer: CustomerData;
  reservation: ReservationData;
}): Record<string, string> {
  const { language, company, customer, reservation } = input;
  const isEn = language.toLowerCase().startsWith('en');
  const fullName = [customer.firstName, customer.lastName1, customer.lastName2].filter(Boolean).join(' ');

  return {
    // Company
    company_name: company.name,
    company_document_name: company.name,
    company_tax_id: company.taxId,
    company_fiscal_address: company.fiscalAddress,
    company_phone: company.phone,
    company_email_from: company.emailFrom,
    company_website: company.website,
    company_document_footer: company.footer,
    company_logo_data_url: company.logoDataUrl,
    company_brand_primary_color: company.brandPrimaryColor,
    company_brand_secondary_color: company.brandSecondaryColor,
    // Customer
    customer_name: fullName || customer.firstName,
    customer_first_name: customer.firstName,
    customer_email: customer.email,
    customer_phone: customer.phone1,
    customer_tax_id: `${customer.documentType} ${customer.documentNumber}`.trim(),
    customer_address: customer.street,
    customer_city: customer.city,
    customer_province: customer.province,
    customer_country: customer.country,
    customer_postal_code: customer.postalCode,
    customer_driving_license: customer.drivingLicenseNumber,
    customer_document_type: customer.documentType,
    customer_document_number: customer.documentNumber,
    customer_nationality: customer.nationality,
    // Reservation
    reservation_number: reservation.reservationNumber,
    reservation_status: reservation.reservationStatus,
    delivery_place: reservation.deliveryPlace,
    delivery_date: formatDate(reservation.deliveryAt, language),
    delivery_time: formatTime(reservation.deliveryAt),
    delivery_flight: reservation.deliveryFlightNumber,
    pickup_place: reservation.pickupPlace,
    pickup_date: formatDate(reservation.pickupAt, language),
    pickup_time: formatTime(reservation.pickupAt),
    pickup_flight: reservation.pickupFlightNumber,
    billed_car_group: reservation.billedCarGroup,
    assigned_plate: reservation.assignedPlate || (isEn ? 'To be assigned' : 'Por asignar'),
    billed_days: String(reservation.billedDays),
    applied_rate: reservation.appliedRate,
    base_amount: formatAmount(reservation.baseAmount),
    extras_amount: formatAmount(reservation.extrasAmount),
    insurance_amount: formatAmount(reservation.insuranceAmount),
    fuel_amount: formatAmount(reservation.fuelAmount),
    discount_amount: formatAmount(reservation.discountAmount),
    total_price: formatAmount(reservation.totalPrice),
    extras_breakdown: reservation.extrasBreakdown,
    deductible: formatAmount(reservation.deductible),
    deposit_amount: formatAmount(reservation.depositAmount),
    public_observations: reservation.publicObservations,
    payments_made: formatAmount(reservation.paymentsMade),
    iva_percent: String(reservation.ivaPercent),
  };
}

export function buildBudgetTemplateData(input: {
  language: string;
  company: CompanyData;
  budget: BudgetData;
}): Record<string, string> {
  const { language, company, budget } = input;

  return {
    // Company
    company_name: company.name,
    company_document_name: company.name,
    company_tax_id: company.taxId,
    company_fiscal_address: company.fiscalAddress,
    company_phone: company.phone,
    company_email_from: company.emailFrom,
    company_website: company.website,
    company_document_footer: company.footer,
    company_logo_data_url: company.logoDataUrl,
    company_brand_primary_color: company.brandPrimaryColor,
    company_brand_secondary_color: company.brandSecondaryColor,
    // Budget
    delivery_place: budget.deliveryPlace,
    delivery_date: formatDate(budget.deliveryAt, language),
    delivery_time: formatTime(budget.deliveryAt),
    pickup_place: budget.pickupPlace,
    pickup_date: formatDate(budget.pickupAt, language),
    pickup_time: formatTime(budget.pickupAt),
    billed_car_group: budget.billedCarGroup,
    billed_days: String(budget.billedDays),
    applied_rate: budget.appliedRate,
    base_amount: formatAmount(budget.baseAmount),
    discount_amount: formatAmount(budget.discountAmount),
    insurance_amount: formatAmount(budget.insuranceAmount),
    extras_amount: formatAmount(budget.extrasAmount),
    fuel_amount: formatAmount(budget.fuelAmount),
    total_amount: formatAmount(budget.totalAmount),
    extras_breakdown: budget.extrasBreakdown,
  };
}
