// ─── Core domain types for RentIQ Gestión V3 ───────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'LECTOR';
export type ReservationStatus = 'PETICION' | 'CONFIRMADA' | 'CANCELADA';
export type ContractStatus = 'ABIERTO' | 'CERRADO' | 'CANCELADO';
export type InvoiceStatus = 'BORRADOR' | 'FINAL';
export type InvoiceType = 'F' | 'V' | 'R' | 'A';
export type ClientType = 'PARTICULAR' | 'EMPRESA' | 'COMISIONISTA';
export type ExpenseCategory = 'PEAJE' | 'GASOLINA' | 'COMIDA' | 'PARKING' | 'LAVADO' | 'OTRO';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO';
export type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'UI_OPEN_MODULE'
  | 'RBAC_DENIED'
  | 'OVERRIDE_CONFIRMATION'
  | 'SYSTEM'
  | 'AUDIT_SUPPRESS';
export type PricingMode = 'PRECIO_A' | 'PRECIO_B' | 'PRECIO_C';
export type TariffCellType = 'FIJO' | 'DIA' | 'KM' | 'DIA_KM' | 'LIBRE';

// ─── User ────────────────────────────────────────────────────────────────────

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Company & Branch ────────────────────────────────────────────────────────

export interface CompanySettings {
  name: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  defaultBranchId: string;
  invoiceSeries: string;
  ivaPercent: number;
  deliveryLocations: string[]; // lugares de entrega/recogida configurados
  overlapMinHours: number;
  graceHours?: number;          // horas de cortesía antes de contar un día adicional
  dayChangeCutoffHour?: number; // hora de corte para cambio de día (0-23)
  minReservationDays?: number;  // días mínimos por reserva
  minAdvanceHours?: number;     // antelación mínima en horas para crear reserva
  quoteValidityDays?: number;   // días de validez de un presupuesto
  defaultDeposit?: number;      // importe de depósito por defecto (€)
  nightFeeFromHour?: number;    // hora de inicio tarifa nocturna (0-23)
  nightFeeToHour?: number;      // hora de fin tarifa nocturna (0-23)
  nightFeePrice?: number;       // precio de la tarifa nocturna (€)
}

export interface WeeklySchedule {
  mon?: DaySchedule;
  tue?: DaySchedule;
  wed?: DaySchedule;
  thu?: DaySchedule;
  fri?: DaySchedule;
  sat?: DaySchedule;
  sun?: DaySchedule;
  exceptions: ScheduleException[];
}

export interface DaySchedule {
  open: string; // HH:MM
  close: string; // HH:MM
}

export interface ScheduleException {
  date: string; // YYYY-MM-DD
  closed: boolean;
  note?: string;
}

export interface CompanyBranch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  active: boolean;
  contractPrefix: string;
  contractCounter: number;
  invoiceCounter: number;
  schedule: WeeklySchedule;
  createdAt: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  type: ClientType;
  name: string;
  surname?: string;
  nif?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  companyName?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  commissionPercent?: number;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Fleet ───────────────────────────────────────────────────────────────────

export interface VehicleCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  defaultInsuranceId?: string;
  active: boolean;
  createdAt: string;
}

export interface VehicleModel {
  id: string;
  brand: string;
  model: string;
  categoryId: string;
  transmission: 'MANUAL' | 'AUTOMATICO';
  fuel: 'GASOLINA' | 'DIESEL' | 'ELECTRICO' | 'HIBRIDO';
  seats: number;
  features: string[];
  active: boolean;
  createdAt: string;
}

export interface FleetVehicle {
  id: string;
  plate: string;
  vin?: string;
  modelId: string;
  categoryId: string;
  branchId: string;
  year: number;
  color?: string;
  owner: string;
  currentOdometer: number;
  active: boolean;
  activeFrom: string;
  activeTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleExtra {
  id: string;
  code: string;
  name: string;
  pricingMode: 'FIXED' | 'PER_DAY';
  unitPrice: number;
  maxDays?: number;
  active: boolean;
  createdAt: string;
}

export interface VehicleInsurance {
  id: string;
  code: string;
  name: string;
  pricingMode: 'FIXED' | 'PER_DAY';
  unitPrice: number;
  maxDays?: number;
  active: boolean;
  createdAt: string;
}

export interface VehicleTask {
  id: string;
  plate: string;
  type: 'LIMPIEZA' | 'ITV' | 'INSPECCION' | 'REVISION' | 'OTRO';
  scheduledDate: string;
  completedDate?: string;
  notes?: string;
  assignedTo?: string;
  status: 'PENDIENTE' | 'COMPLETADA' | 'CANCELADA';
  createdAt: string;
}

// ─── Reservation ─────────────────────────────────────────────────────────────

export interface ReservationExtra {
  extraId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReservationAuditEntry {
  at: string;
  by: string;
  action: string;
  detail?: string;
}

export interface Reservation {
  id: string;
  number: string; // RSV-{YYYY}-{000001}
  branchId: string;        // sucursal gestora
  pickupLocation: string;  // lugar de entrega (texto libre)
  returnLocation: string;  // lugar de recogida (texto libre)
  clientId: string;
  categoryId: string;
  requestedModelId?: string;
  assignedPlate?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:MM
  billedDays: number;
  tariffPlanId?: string;
  basePrice: number;
  extrasTotal: number;
  insuranceTotal: number;
  fuelCharge: number;
  penalties: number;
  discount: number;
  total: number;
  extras: ReservationExtra[];
  salesChannelId?: string;
  status: ReservationStatus;
  contractId?: string;
  notes?: string;
  confirmationSentAt?: string;
  confirmationSentTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  auditLog: ReservationAuditEntry[];
}

// ─── Contract ────────────────────────────────────────────────────────────────

export interface ContractPayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  notes?: string;
  isRefund: boolean;
  recordedAt: string;
  recordedBy: string;
}

export interface ContractAuditEntry {
  at: string;
  by: string;
  action: string;
  detail?: string;
}

export interface Contract {
  id: string;
  number: string;
  branchId: string;
  reservationId?: string;
  clientId: string;
  plate: string;
  categoryId: string;
  pickupLocation: string;  // heredado de la reserva origen
  returnLocation: string;  // heredado de la reserva origen
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  billedDays: number;
  basePrice: number;
  extrasTotal: number;
  insuranceTotal: number;
  fuelCharge: number;
  penalties: number;
  discount: number;
  total: number;
  extras: ReservationExtra[];
  status: ContractStatus;
  invoiceId?: string;
  checkout?: {
    doneAt: string;
    doneBy: string;
    kmOut: number;
    fuelOut: number;
    notes?: string;
    photoUrls: string[];
    signatureUrl?: string;
  };
  checkin?: {
    doneAt: string;
    doneBy: string;
    kmIn: number;
    fuelIn: number;
    notes?: string;
    photoUrls: string[];
    signatureUrl?: string;
  };
  payments: ContractPayment[];
  internalExpenseIds: string[];
  notes?: string;
  closedAt?: string;
  closedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  auditLog: ContractAuditEntry[];
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export interface InvoiceSendLog {
  sentAt: string;
  sentBy: string;
  sentTo: string;
  success: boolean;
  errorMessage?: string;
}

export interface Invoice {
  id: string;
  number: string;
  series: string;
  branchId: string;
  contractId: string;
  clientId: string;
  type: InvoiceType;
  date: string;
  baseAmount: number;
  extrasAmount: number;
  insuranceAmount: number;
  fuelAmount: number;
  penalties: number;
  discount: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
  status: InvoiceStatus;
  emailSentAt?: string;
  emailSentTo?: string;
  emailSentBy?: string;
  sendLog: InvoiceSendLog[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Tariffs ─────────────────────────────────────────────────────────────────

export interface TariffPlan {
  id: string;
  name: string;
  code: string;
  pricingMode?: PricingMode;
  validFrom: string;
  validTo: string;
  active: boolean;
  createdAt: string;
}

export interface TariffBracket {
  id: string;
  planId: string;
  label: string;
  minDays: number;
  maxDays: number | null;
  maxKmPerDay?: number;
  order: number;
  isExtraDay?: boolean;
}

export interface TariffPrice {
  id: string;
  planId: string;
  bracketId: string;
  categoryId: string;
  pricingType: TariffCellType;
  price: number;
  priceKm?: number;
  kmIncluidos?: number;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export interface DailyExpense {
  id: string;
  batchId: string;
  date: string;
  plate: string;
  category: ExpenseCategory;
  amount: number;
  worker?: string;
  contractId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Sales Channels ──────────────────────────────────────────────────────────

export interface SalesChannel {
  id: string;
  name: string;
  code: string;
  commissionPercent: number;
  active: boolean;
  createdAt: string;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface TemplateDocument {
  id: string;
  name: string;
  type: 'CONTRATO' | 'CONFIRMACION_RESERVA' | 'FACTURA';
  language: 'es' | 'en';
  subject?: string;
  htmlContent: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  action: AuditAction;
  actorId: string;
  actorRole: UserRole;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  suppressedAt?: string;
  suppressedBy?: string;
  suppressReason?: string;
  at: string; // ISO timestamp
}

// ─── Vehicle Block ────────────────────────────────────────────────────────────

export interface VehicleBlock {
  id: string;
  plate: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string;
  /** MANUAL = no disponible/fuera de servicio (oscuro) · PLATE = matrícula bloqueada/reservado (morado) */
  blockType?: 'MANUAL' | 'PLATE';
  createdBy: string;
  createdAt: string;
}

// ─── Store Shape ─────────────────────────────────────────────────────────────

export interface RentalStore {
  meta: { version: string; lastUpdated: string };
  settings: CompanySettings;
  branches: CompanyBranch[];
  users: UserAccount[];
  clients: Client[];
  vehicles: FleetVehicle[];
  vehicleCategories: VehicleCategory[];
  vehicleModels: VehicleModel[];
  vehicleExtras: VehicleExtra[];
  vehicleInsurances: VehicleInsurance[];
  vehicleTasks: VehicleTask[];
  reservations: Reservation[];
  contracts: Contract[];
  invoices: Invoice[];
  tariffPlans: TariffPlan[];
  tariffBrackets: TariffBracket[];
  tariffPrices: TariffPrice[];
  expenses: DailyExpense[];
  salesChannels: SalesChannel[];
  templates: TemplateDocument[];
  vehicleBlocks: VehicleBlock[];
}
