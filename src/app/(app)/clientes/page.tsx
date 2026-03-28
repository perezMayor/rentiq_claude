'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import type { ClientType, ReservationStatus, DocumentType, LicenseType, DiscountType, PromoScope } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import styles from './clientes.module.css';
import PrintButton from '@/src/components/PrintButton';

// ─── Extended reservation shape from API ─────────────────────────────────────

interface ReservationFull {
  id: string;
  number: string;
  clientId: string;
  startDate: string;
  endDate: string;
  assignedPlate?: string;
  billedDays: number;
  total: number;
  status: ReservationStatus;
  contractId?: string;
}

// ─── Address shape ────────────────────────────────────────────────────────────

interface Address {
  street?: string;
  city?: string;
  postCode?: string;
  province?: string;
  country?: string;
}

// ─── Local Client type ────────────────────────────────────────────────────────

interface Client {
  id: string;
  type: ClientType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  name: string;
  surname?: string;
  nationality?: string;
  birthPlace?: string;
  birthDate?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  nif?: string;
  documentIssuePlace?: string;
  documentIssueDate?: string;
  documentExpiryDate?: string;
  licenseNumber?: string;
  licenseType?: LicenseType;
  licenseIssuePlace?: string;
  licenseIssueDate?: string;
  licenseExpiry?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  preferredLanguage?: string;
  address?: string;
  city?: string;
  postCode?: string;
  country?: string;
  mainAddress?: Address;
  localAddress?: Address;
  paymentMethod?: string;
  notes?: string;
  alerts?: string;
  companyId?: string;
  companyName?: string;
  driverIds?: string[];
  commissionPercent?: number;
}

interface ReservationSummary {
  id: string;
  number: string;
  startDate: string;
  endDate: string;
  total: number;
  status: ReservationStatus;
  contractId?: string;
}

// ─── PromoCode local type ─────────────────────────────────────────────────────

interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  scope: PromoScope;
  categoryId?: string;
  clientId?: string;
  comisionistaId?: string;
  validFrom?: string;
  validTo?: string;
  maxUses?: number;
  usedCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Form data ────────────────────────────────────────────────────────────────

interface ClientFormData {
  type: ClientType;
  active: boolean;
  // Personal
  name: string;
  surname: string;
  nationality: string;
  birthPlace: string;
  birthDate: string;
  // Document
  documentType: DocumentType | '';
  documentNumber: string;
  documentIssuePlace: string;
  documentIssueDate: string;
  documentExpiryDate: string;
  // License
  licenseNumber: string;
  licenseType: LicenseType | '';
  licenseIssuePlace: string;
  licenseIssueDate: string;
  licenseExpiry: string;
  // Contact
  phone: string;
  phone2: string;
  email: string;
  preferredLanguage: string;
  // Addresses
  mainStreet: string;
  mainCity: string;
  mainPostCode: string;
  mainProvince: string;
  mainCountry: string;
  localStreet: string;
  localCity: string;
  localPostCode: string;
  localProvince: string;
  localCountry: string;
  // Payment & notes
  paymentMethod: string;
  notes: string;
  alerts: string;
  // Company link
  companyId: string;
  // EMPRESA specific
  companyName: string;
  driverIds: string[];
  // COMISIONISTA
  commissionPercent: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blankForm(type: ClientType = 'PARTICULAR'): ClientFormData {
  return {
    type,
    active: true,
    name: '',
    surname: '',
    nationality: '',
    birthPlace: '',
    birthDate: '',
    documentType: '',
    documentNumber: '',
    documentIssuePlace: '',
    documentIssueDate: '',
    documentExpiryDate: '',
    licenseNumber: '',
    licenseType: '',
    licenseIssuePlace: '',
    licenseIssueDate: '',
    licenseExpiry: '',
    phone: '',
    phone2: '',
    email: '',
    preferredLanguage: 'es',
    mainStreet: '',
    mainCity: '',
    mainPostCode: '',
    mainProvince: '',
    mainCountry: 'España',
    localStreet: '',
    localCity: '',
    localPostCode: '',
    localProvince: '',
    localCountry: '',
    paymentMethod: '',
    notes: '',
    alerts: '',
    companyId: '',
    companyName: '',
    driverIds: [],
    commissionPercent: '',
  };
}

function clientToForm(c: Client): ClientFormData {
  const main = c.mainAddress;
  const local = c.localAddress;
  return {
    type: c.type,
    active: c.active,
    name: c.name,
    surname: c.surname ?? '',
    nationality: c.nationality ?? '',
    birthPlace: c.birthPlace ?? '',
    birthDate: c.birthDate ?? '',
    documentType: (c.documentType as DocumentType) ?? '',
    documentNumber: c.documentNumber ?? c.nif ?? '',
    documentIssuePlace: c.documentIssuePlace ?? '',
    documentIssueDate: c.documentIssueDate ?? '',
    documentExpiryDate: c.documentExpiryDate ?? '',
    licenseNumber: c.licenseNumber ?? '',
    licenseType: (c.licenseType as LicenseType) ?? '',
    licenseIssuePlace: c.licenseIssuePlace ?? '',
    licenseIssueDate: c.licenseIssueDate ?? '',
    licenseExpiry: c.licenseExpiry ?? '',
    phone: c.phone ?? '',
    phone2: c.phone2 ?? '',
    email: c.email ?? '',
    preferredLanguage: c.preferredLanguage ?? 'es',
    mainStreet: main?.street ?? c.address ?? '',
    mainCity: main?.city ?? c.city ?? '',
    mainPostCode: main?.postCode ?? c.postCode ?? '',
    mainProvince: main?.province ?? '',
    mainCountry: main?.country ?? c.country ?? 'España',
    localStreet: local?.street ?? '',
    localCity: local?.city ?? '',
    localPostCode: local?.postCode ?? '',
    localProvince: local?.province ?? '',
    localCountry: local?.country ?? '',
    paymentMethod: c.paymentMethod ?? '',
    notes: c.notes ?? '',
    alerts: c.alerts ?? '',
    companyId: c.companyId ?? '',
    companyName: c.companyName ?? '',
    driverIds: c.driverIds ?? [],
    commissionPercent: c.commissionPercent !== undefined ? String(c.commissionPercent) : '',
  };
}

function formToPayload(form: ClientFormData, isCreate: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    surname: form.surname.trim() || undefined,
    active: form.active,
    nationality: form.nationality.trim() || undefined,
    birthPlace: form.birthPlace.trim() || undefined,
    birthDate: form.birthDate || undefined,
    documentType: form.documentType || undefined,
    documentNumber: form.documentNumber.trim() || undefined,
    nif: form.documentNumber.trim() || undefined,
    documentIssuePlace: form.documentIssuePlace.trim() || undefined,
    documentIssueDate: form.documentIssueDate || undefined,
    documentExpiryDate: form.documentExpiryDate || undefined,
    licenseNumber: form.licenseNumber.trim() || undefined,
    licenseType: form.licenseType || undefined,
    licenseIssuePlace: form.licenseIssuePlace.trim() || undefined,
    licenseIssueDate: form.licenseIssueDate || undefined,
    licenseExpiry: form.licenseExpiry || undefined,
    phone: form.phone.trim() || undefined,
    phone2: form.phone2.trim() || undefined,
    email: form.email.trim() || undefined,
    preferredLanguage: form.preferredLanguage || 'es',
    // Legacy flat compat fields
    address: form.mainStreet.trim() || undefined,
    city: form.mainCity.trim() || undefined,
    postCode: form.mainPostCode.trim() || undefined,
    country: form.mainCountry.trim() || undefined,
    mainAddress: (form.mainStreet || form.mainCity || form.mainPostCode || form.mainProvince || form.mainCountry) ? {
      street: form.mainStreet.trim() || undefined,
      city: form.mainCity.trim() || undefined,
      postCode: form.mainPostCode.trim() || undefined,
      province: form.mainProvince.trim() || undefined,
      country: form.mainCountry.trim() || undefined,
    } : undefined,
    localAddress: (form.localStreet || form.localCity || form.localPostCode || form.localProvince || form.localCountry) ? {
      street: form.localStreet.trim() || undefined,
      city: form.localCity.trim() || undefined,
      postCode: form.localPostCode.trim() || undefined,
      province: form.localProvince.trim() || undefined,
      country: form.localCountry.trim() || undefined,
    } : undefined,
    paymentMethod: form.paymentMethod || undefined,
    notes: form.notes.trim() || undefined,
    alerts: form.alerts.trim() || undefined,
    companyId: form.companyId || undefined,
    companyName: form.companyName.trim() || undefined,
    driverIds: form.driverIds.length > 0 ? form.driverIds : undefined,
  };

  if (form.type === 'COMISIONISTA' && form.commissionPercent !== '') {
    const pct = parseFloat(form.commissionPercent);
    if (!isNaN(pct) && pct >= 0 && pct <= 100) payload.commissionPercent = pct;
  }

  if (isCreate) payload.type = form.type;
  return payload;
}

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function displayName(c: Client): string {
  if (c.type === 'EMPRESA') return c.companyName ?? c.name;
  if (c.type === 'COMISIONISTA') return `${c.name}${c.surname ? ' ' + c.surname : ''} (Comisionista)`;
  return `${c.name}${c.surname ? ' ' + c.surname : ''}`;
}

function typeBadge(type: ClientType): React.ReactElement | null {
  if (type === 'EMPRESA') {
    return <span className="badge badge-confirmada">Empresa</span>;
  }
  if (type === 'COMISIONISTA') {
    return <span className="badge badge-peticion">Comisionista</span>;
  }
  return null;
}

function typeLabel(type: ClientType): string {
  const map: Record<ClientType, string> = {
    PARTICULAR: 'Particular',
    EMPRESA: 'Empresa',
    COMISIONISTA: 'Comisionista',
  };
  return map[type];
}

function reservationStatusLabel(r: ReservationSummary): string {
  if (r.contractId) return 'Contratada';
  const map: Record<ReservationStatus, string> = {
    PETICION: 'Peticion',
    CONFIRMADA: 'Confirmada',
    CANCELADA: 'Cancelada',
  };
  return map[r.status] ?? r.status;
}

function reservationStatusBadge(r: ReservationSummary): string {
  if (r.contractId) return 'badge-contratado';
  const map: Record<ReservationStatus, string> = {
    PETICION: 'badge-peticion',
    CONFIRMADA: 'badge-confirmada',
    CANCELADA: 'badge-cancelada',
  };
  return map[r.status] ?? 'badge-cancelada';
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ gridColumn: '1/-1', borderBottom: '1px solid var(--color-border)', paddingBottom: 6, marginBottom: 4, marginTop: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
      {label}
    </div>
  );
}

// ─── Client form body (shared between create modal and ficha edit modal) ──────

function ClientFormBody({
  form,
  setForm,
  isCreate,
  empresaClients,
  allClients,
}: {
  form: ClientFormData;
  setForm: (f: ClientFormData) => void;
  isCreate: boolean;
  empresaClients: Client[];
  allClients: Client[];
}) {
  const [showCompanyLink, setShowCompanyLink] = useState(!!form.companyId);
  const [driverSearch, setDriverSearch] = useState('');

  function fg(field: keyof ClientFormData, value: string | boolean | string[]) {
    setForm({ ...form, [field]: value });
  }

  // Driver management for EMPRESA
  function addDriver(clientId: string) {
    if (!form.driverIds.includes(clientId)) {
      setForm({ ...form, driverIds: [...form.driverIds, clientId] });
    }
    setDriverSearch('');
  }

  function removeDriver(clientId: string) {
    setForm({ ...form, driverIds: form.driverIds.filter((id) => id !== clientId) });
  }

  const particularClients = allClients.filter((c) => c.type === 'PARTICULAR' && c.active);
  const driverSearchResults = driverSearch.trim()
    ? particularClients.filter((c) => {
        const q = driverSearch.toLowerCase();
        return [c.name, c.surname, c.documentNumber, c.nif, c.email].filter(Boolean).join(' ').toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  return (
    <div className="form-grid">
      {/* Type selector — only on create */}
      {isCreate && (
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label className="form-label">Tipo de cliente *</label>
          <select
            className="form-select"
            value={form.type}
            onChange={(e) => setForm({ ...blankForm(e.target.value as ClientType), type: e.target.value as ClientType })}
          >
            <option value="PARTICULAR">Particular</option>
            <option value="EMPRESA">Empresa</option>
            <option value="COMISIONISTA">Comisionista</option>
          </select>
        </div>
      )}

      {!isCreate && (
        <div className="form-group">
          <label className="form-label">Tipo de cliente</label>
          <input className="form-input" value={typeLabel(form.type)} readOnly style={{ opacity: 0.6 }} />
          <span className={styles.typeNote}>El tipo no puede modificarse</span>
        </div>
      )}

      {/* ── PARTICULAR ──────────────────────────────────────────────────── */}
      {form.type === 'PARTICULAR' && (
        <>
          <SectionHeader label="Datos personales" />
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-input" value={form.name} onChange={(e) => fg('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Apellidos</label>
            <input className="form-input" value={form.surname} onChange={(e) => fg('surname', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nacionalidad</label>
            <input className="form-input" value={form.nationality} onChange={(e) => fg('nationality', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Lugar de nacimiento</label>
            <input className="form-input" value={form.birthPlace} onChange={(e) => fg('birthPlace', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de nacimiento</label>
            <DatePicker className="form-input" value={form.birthDate} onChange={(v) => fg('birthDate', v)} />
          </div>

          <SectionHeader label="Documento de identidad" />
          <div className="form-group">
            <label className="form-label">Tipo de documento</label>
            <select className="form-select" value={form.documentType} onChange={(e) => fg('documentType', e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="DNI">DNI</option>
              <option value="NIE">NIE</option>
              <option value="PASAPORTE">Pasaporte</option>
              <option value="PERMISO_RESIDENCIA">Permiso de residencia</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Número</label>
            <input className="form-input" value={form.documentNumber} onChange={(e) => fg('documentNumber', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Lugar de expedición</label>
            <input className="form-input" value={form.documentIssuePlace} onChange={(e) => fg('documentIssuePlace', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de expedición</label>
            <DatePicker className="form-input" value={form.documentIssueDate} onChange={(v) => fg('documentIssueDate', v)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de caducidad</label>
            <DatePicker className="form-input" value={form.documentExpiryDate} onChange={(v) => fg('documentExpiryDate', v)} />
          </div>

          <SectionHeader label="Carnet de conducir" />
          <div className="form-group">
            <label className="form-label">Número</label>
            <input className="form-input" value={form.licenseNumber} onChange={(e) => fg('licenseNumber', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={form.licenseType} onChange={(e) => fg('licenseType', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {(['B','A','A1','A2','AM','BE','C','CE','D','DE','OTRO'] as LicenseType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Lugar de expedición</label>
            <input className="form-input" value={form.licenseIssuePlace} onChange={(e) => fg('licenseIssuePlace', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de expedición</label>
            <DatePicker className="form-input" value={form.licenseIssueDate} onChange={(v) => fg('licenseIssueDate', v)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha de caducidad</label>
            <DatePicker className="form-input" value={form.licenseExpiry} onChange={(v) => fg('licenseExpiry', v)} />
          </div>

          <SectionHeader label="Contacto" />
          <div className="form-group">
            <label className="form-label">Teléfono 1</label>
            <input type="tel" className="form-input" value={form.phone} onChange={(e) => fg('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono 2</label>
            <input type="tel" className="form-input" value={form.phone2} onChange={(e) => fg('phone2', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={(e) => fg('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Idioma documentos</label>
            <select className="form-select" value={form.preferredLanguage} onChange={(e) => fg('preferredLanguage', e.target.value)}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="it">Italiano</option>
              <option value="pt">Português</option>
              <option value="nl">Nederlands</option>
              <option value="ru">Русский</option>
              <option value="zh">中文</option>
              <option value="ar">العربية</option>
            </select>
          </div>

          <SectionHeader label="Dirección habitual" />
          <div className="form-group col-span-2">
            <label className="form-label">Calle</label>
            <input className="form-input" value={form.mainStreet} onChange={(e) => fg('mainStreet', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <input className="form-input" value={form.mainCity} onChange={(e) => fg('mainCity', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Código postal</label>
            <input className="form-input" value={form.mainPostCode} onChange={(e) => fg('mainPostCode', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Provincia</label>
            <input className="form-input" value={form.mainProvince} onChange={(e) => fg('mainProvince', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">País</label>
            <input className="form-input" value={form.mainCountry} onChange={(e) => fg('mainCountry', e.target.value)} />
          </div>

          <SectionHeader label="Dirección local (vacaciones / temporal)" />
          <div className="form-group col-span-2">
            <label className="form-label">Calle</label>
            <input className="form-input" value={form.localStreet} onChange={(e) => fg('localStreet', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <input className="form-input" value={form.localCity} onChange={(e) => fg('localCity', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Código postal</label>
            <input className="form-input" value={form.localPostCode} onChange={(e) => fg('localPostCode', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Provincia</label>
            <input className="form-input" value={form.localProvince} onChange={(e) => fg('localProvince', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">País</label>
            <input className="form-input" value={form.localCountry} onChange={(e) => fg('localCountry', e.target.value)} />
          </div>

          <SectionHeader label="Preferencias" />
          <div className="form-group">
            <label className="form-label">Modo de pago</label>
            <select className="form-select" value={form.paymentMethod} onChange={(e) => fg('paymentMethod', e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="BIZUM">Bizum</option>
              <option value="CHEQUE">Cheque</option>
              <option value="DOMICILIACION">Domiciliación</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-select" value={form.active ? 'true' : 'false'} onChange={(e) => fg('active', e.target.value === 'true')}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          <SectionHeader label="Observaciones" />
          <div className="form-group col-span-2">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e) => fg('notes', e.target.value)} rows={3} />
          </div>

          <SectionHeader label="Avisos" />
          <div className="form-group col-span-2">
            <label className="form-label">Aviso (se muestra al seleccionar este cliente)</label>
            <textarea
              className="form-textarea"
              value={form.alerts}
              onChange={(e) => fg('alerts', e.target.value)}
              rows={2}
              style={{ border: '2px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}
              placeholder="Escribe un aviso que se mostrará al seleccionar este cliente en formularios..."
            />
          </div>

          <SectionHeader label="Empresa vinculada" />
          <div className="form-group col-span-2">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={showCompanyLink}
                onChange={(e) => {
                  setShowCompanyLink(e.target.checked);
                  if (!e.target.checked) fg('companyId', '');
                }}
              />
              Pertenece a una empresa
            </label>
          </div>
          {showCompanyLink && (
            <div className="form-group col-span-2">
              <label className="form-label">Empresa</label>
              <select className="form-select" value={form.companyId} onChange={(e) => fg('companyId', e.target.value)}>
                <option value="">— Seleccionar empresa —</option>
                {empresaClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName ?? c.name}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* ── EMPRESA ─────────────────────────────────────────────────────── */}
      {form.type === 'EMPRESA' && (
        <>
          <SectionHeader label="Datos de la empresa" />
          <div className="form-group col-span-2">
            <label className="form-label">Razón social *</label>
            <input className="form-input" value={form.companyName} onChange={(e) => fg('companyName', e.target.value)} placeholder="Nombre de la empresa" />
          </div>
          <div className="form-group">
            <label className="form-label">CIF *</label>
            <input className="form-input" value={form.documentNumber} onChange={(e) => fg('documentNumber', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input type="tel" className="form-input" value={form.phone} onChange={(e) => fg('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono 2</label>
            <input type="tel" className="form-input" value={form.phone2} onChange={(e) => fg('phone2', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={(e) => fg('email', e.target.value)} />
          </div>

          <SectionHeader label="Persona de contacto" />
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="form-input" value={form.name} onChange={(e) => fg('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Apellido</label>
            <input className="form-input" value={form.surname} onChange={(e) => fg('surname', e.target.value)} />
          </div>

          <SectionHeader label="Dirección" />
          <div className="form-group col-span-2">
            <label className="form-label">Calle</label>
            <input className="form-input" value={form.mainStreet} onChange={(e) => fg('mainStreet', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <input className="form-input" value={form.mainCity} onChange={(e) => fg('mainCity', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Código postal</label>
            <input className="form-input" value={form.mainPostCode} onChange={(e) => fg('mainPostCode', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Provincia</label>
            <input className="form-input" value={form.mainProvince} onChange={(e) => fg('mainProvince', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">País</label>
            <input className="form-input" value={form.mainCountry} onChange={(e) => fg('mainCountry', e.target.value)} />
          </div>

          <SectionHeader label="Preferencias" />
          <div className="form-group">
            <label className="form-label">Modo de pago</label>
            <select className="form-select" value={form.paymentMethod} onChange={(e) => fg('paymentMethod', e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="BIZUM">Bizum</option>
              <option value="CHEQUE">Cheque</option>
              <option value="DOMICILIACION">Domiciliación</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-select" value={form.active ? 'true' : 'false'} onChange={(e) => fg('active', e.target.value === 'true')}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          <SectionHeader label="Conductores de empresa" />
          <div className="form-group col-span-2">
            {form.driverIds.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <table className="data-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Conductor</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.driverIds.map((dId) => {
                      const dc = allClients.find((c) => c.id === dId);
                      return (
                        <tr key={dId}>
                          <td>{dc ? displayName(dc) : dId}</td>
                          <td>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeDriver(dId)}>
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                placeholder="+ Añadir conductor (buscar por nombre o DNI)..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                style={{ fontSize: '0.82rem' }}
              />
              {driverSearchResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-surface-strong)', border: '1px solid var(--color-border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  {driverSearchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addDriver(c.id)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text-primary)' }}
                    >
                      {displayName(c)}{(c.documentNumber || c.nif) ? ` — ${c.documentNumber ?? c.nif}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SectionHeader label="Observaciones" />
          <div className="form-group col-span-2">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e) => fg('notes', e.target.value)} rows={3} />
          </div>

          <SectionHeader label="Avisos" />
          <div className="form-group col-span-2">
            <label className="form-label">Aviso (se muestra al seleccionar esta empresa)</label>
            <textarea
              className="form-textarea"
              value={form.alerts}
              onChange={(e) => fg('alerts', e.target.value)}
              rows={2}
              style={{ border: '2px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}
            />
          </div>
        </>
      )}

      {/* ── COMISIONISTA ────────────────────────────────────────────────── */}
      {form.type === 'COMISIONISTA' && (
        <>
          <SectionHeader label="Datos del comisionista" />
          <div className="form-group col-span-2">
            <label className="form-label">Razón social *</label>
            <input className="form-input" value={form.companyName || form.name} onChange={(e) => {
              setForm({ ...form, companyName: e.target.value, name: e.target.value });
            }} placeholder="Nombre o razón social" />
          </div>
          <div className="form-group">
            <label className="form-label">CIF / NIF *</label>
            <input className="form-input" value={form.documentNumber} onChange={(e) => fg('documentNumber', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input type="tel" className="form-input" value={form.phone} onChange={(e) => fg('phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={(e) => fg('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Comisión (%) *</label>
            <input
              type="number"
              className="form-input"
              value={form.commissionPercent}
              onChange={(e) => fg('commissionPercent', e.target.value)}
              min={0}
              max={100}
              step={0.1}
              placeholder="0 — 100"
            />
          </div>

          <SectionHeader label="Dirección" />
          <div className="form-group col-span-2">
            <label className="form-label">Calle</label>
            <input className="form-input" value={form.mainStreet} onChange={(e) => fg('mainStreet', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Ciudad</label>
            <input className="form-input" value={form.mainCity} onChange={(e) => fg('mainCity', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Código postal</label>
            <input className="form-input" value={form.mainPostCode} onChange={(e) => fg('mainPostCode', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Provincia</label>
            <input className="form-input" value={form.mainProvince} onChange={(e) => fg('mainProvince', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">País</label>
            <input className="form-input" value={form.mainCountry} onChange={(e) => fg('mainCountry', e.target.value)} />
          </div>

          <SectionHeader label="Preferencias" />
          <div className="form-group">
            <label className="form-label">Modo de pago</label>
            <select className="form-select" value={form.paymentMethod} onChange={(e) => fg('paymentMethod', e.target.value)}>
              <option value="">— Seleccionar —</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="BIZUM">Bizum</option>
              <option value="CHEQUE">Cheque</option>
              <option value="DOMICILIACION">Domiciliación</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-select" value={form.active ? 'true' : 'false'} onChange={(e) => fg('active', e.target.value === 'true')}>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          <SectionHeader label="Observaciones" />
          <div className="form-group col-span-2">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e) => fg('notes', e.target.value)} rows={3} />
          </div>

          <SectionHeader label="Avisos" />
          <div className="form-group col-span-2">
            <label className="form-label">Aviso (se muestra al seleccionar este comisionista)</label>
            <textarea
              className="form-textarea"
              value={form.alerts}
              onChange={(e) => fg('alerts', e.target.value)}
              rows={2}
              style={{ border: '2px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Component: ClientesContent (Listado tab) ─────────────────────────────────

function ClientesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterActive, setFilterActive] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Form modal
  const [formModal, setFormModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormData>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // History modal
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [historyReservations, setHistoryReservations] = useState<ReservationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes');
      if (!res.ok) throw new Error('Error al cargar clientes');
      const data = await res.json() as { clients: Client[] };
      setClients(data.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();

    // Get user role
    fetch('/api/me')
      .then((r) => r.ok ? r.json() as Promise<{ role: string }> : Promise.resolve({ role: '' }))
      .then((d) => setUserRole(d.role ?? ''))
      .catch(() => {/* non-critical */});
  }, [fetchClients]);

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filtered = clients.filter((c) => {
    if (filterType && c.type !== filterType) return false;
    if (filterActive && !c.active) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const haystack = [c.name, c.surname, c.documentNumber, c.nif, c.email, c.companyName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const canWriteAction = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const empresaClients = clients.filter((c) => c.type === 'EMPRESA' && c.active);

  // ─── Create ───────────────────────────────────────────────────────────────

  function openCreate() {
    setForm(blankForm('PARTICULAR'));
    setEditingId(null);
    setFormError(null);
    setFormModal('create');
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  function openEdit(c: Client) {
    setForm(clientToForm(c));
    setEditingId(c.id);
    setFormError(null);
    setFormModal('edit');
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim() && form.type !== 'EMPRESA') {
      setFormError('El nombre es obligatorio');
      return;
    }
    if (form.type === 'EMPRESA' && !form.companyName.trim()) {
      setFormError('La razón social es obligatoria');
      return;
    }

    const payload = formToPayload(form, formModal === 'create');

    setSaving(true);
    try {
      const url = formModal === 'edit' && editingId
        ? `/api/clientes/${editingId}`
        : '/api/clientes';
      const method = formModal === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? 'Error al guardar');
        return;
      }
      setFormModal(null);
      void fetchClients();
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(c: Client) {
    if (!confirm(`Eliminar cliente "${displayName(c)}"? Esta acción no se puede deshacer.`)) return;

    const res = await fetch(`/api/clientes/${c.id}`, { method: 'DELETE' });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      alert(data.error ?? 'No se pudo eliminar');
      return;
    }
    void fetchClients();
  }

  // ─── History ──────────────────────────────────────────────────────────────

  async function openHistory(c: Client) {
    setHistoryClient(c);
    setHistoryReservations([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/clientes/${c.id}/reservas`);
      if (res.ok) {
        const data = await res.json() as { reservations: ReservationSummary[] };
        setHistoryReservations(data.reservations ?? []);
      }
    } catch {
      // non-critical
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryClient(null);
    setHistoryReservations([]);
  }

  // ─── Navigate to ficha tab ─────────────────────────────────────────────────

  function openFicha(c: Client) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'ficha');
    p.set('clientId', c.id);
    router.push(`${pathname}?${p.toString()}`);
  }

  const [clientsWithActivity] = useState<Set<string>>(new Set());

  function clientHasActivity(c: Client): boolean {
    return clientsWithActivity.has(c.id);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── FILTERS BAR ───────────────────────────────────────────────────── */}
      <div className="filters-bar">
        <select
          className="form-select"
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setHasSearched(true); }}
        >
          <option value="">Todos los tipos</option>
          <option value="PARTICULAR">Particular</option>
          <option value="EMPRESA">Empresa</option>
          <option value="COMISIONISTA">Comisionista</option>
        </select>

        <label className={styles.filterCheckbox}>
          <input
            type="checkbox"
            checked={filterActive}
            onChange={(e) => { setFilterActive(e.target.checked); setHasSearched(true); }}
          />
          Solo activos
        </label>

        <input
          className="form-input"
          placeholder="Buscar nombre, DNI, email..."
          value={filterSearch}
          onChange={(e) => { setFilterSearch(e.target.value); setHasSearched(true); }}
          style={{ minWidth: 220 }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => setHasSearched(true)}>
          Listar
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {loading ? '…' : `${filtered.length} cliente${filtered.length !== 1 ? 's' : ''}`}
        </span>
        {canWriteAction && (
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            + Nuevo Cliente
          </button>
        )}
      </div>

      {/* ── ERROR ─────────────────────────────────────────────────────────── */}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* ── TABLE ─────────────────────────────────────────────────────────── */}
      {!hasSearched ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
      ) : (
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI / CIF</th>
              <th>Tipo</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state__text">Cargando clientes...</div>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state__text">No hay clientes que coincidan con los filtros.</div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const hasActivity = clientHasActivity(c);
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openFicha(c)}>
                    <td>
                      <div className={styles.clientName}>{displayName(c)}</div>
                      {c.type === 'EMPRESA' && c.name && (
                        <div className={styles.clientSub}>{c.name}</div>
                      )}
                    </td>
                    <td className="text-muted">{c.documentNumber ?? c.nif ?? '—'}</td>
                    <td>
                      {typeBadge(c.type) ?? (
                        <span className="text-muted">{typeLabel(c.type)}</span>
                      )}
                    </td>
                    <td className="text-muted">{c.phone ?? '—'}</td>
                    <td className="text-muted">{c.email ?? '—'}</td>
                    <td>
                      {c.active ? (
                        <span className="text-muted">Activo</span>
                      ) : (
                        <span className="badge badge-cancelada">Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openFicha(c)}
                        >
                          Ver ficha
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => void openHistory(c)}
                        >
                          Historial
                        </button>

                        {canWriteAction && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(c)}
                          >
                            Editar
                          </button>
                        )}

                        {canWriteAction && (
                          hasActivity ? (
                            <span className={styles.disabledAction}>
                              <button className="btn btn-danger btn-sm" disabled>
                                Eliminar
                              </button>
                              <span className={styles.tooltip}>
                                Tiene reservas asociadas
                              </span>
                            </span>
                          ) : (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleDelete(c)}
                            >
                              Eliminar
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* ── MODAL: FORM (create / edit) ───────────────────────────────────── */}
      {formModal !== null && (
        <div className="modal-overlay" onClick={() => setFormModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal__header">
              <h2 className="modal__title">
                {formModal === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
              </h2>
              <button className="modal__close" onClick={() => setFormModal(null)}>
                ×
              </button>
            </div>
            <div className="modal__body">
              {formError && <div className="alert alert-danger">{formError}</div>}
              <ClientFormBody
                form={form}
                setForm={setForm}
                isCreate={formModal === 'create'}
                empresaClients={empresaClients}
                allClients={clients}
              />
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setFormModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HISTORY ────────────────────────────────────────────────── */}
      {historyClient !== null && (
        <div className="modal-overlay" onClick={closeHistory}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal__header">
              <div className={styles.historyHeader}>
                <h2 className="modal__title">{displayName(historyClient)}</h2>
                <div className={styles.historyClientType}>
                  {typeBadge(historyClient.type) ?? (
                    <span className="text-muted">{typeLabel(historyClient.type)}</span>
                  )}
                  {(historyClient.documentNumber ?? historyClient.nif) && (
                    <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                      {historyClient.documentNumber ?? historyClient.nif}
                    </span>
                  )}
                </div>
              </div>
              <button className="modal__close" onClick={closeHistory}>
                ×
              </button>
            </div>
            <div className="modal__body">
              {/* Stats */}
              {!historyLoading && (
                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total reservas</span>
                    <span className={styles.statValue}>{historyReservations.length}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total facturado</span>
                    <span className={styles.statValue}>
                      {historyReservations
                        .reduce((sum, r) => sum + r.total, 0)
                        .toFixed(2)}{' '}
                      &euro;
                    </span>
                  </div>
                </div>
              )}

              {historyLoading ? (
                <div className="empty-state">
                  <div className="empty-state__text">Cargando historial...</div>
                </div>
              ) : historyReservations.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__text">Este cliente no tiene reservas registradas.</div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Numero</th>
                        <th>Fechas</th>
                        <th>Total</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyReservations.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.number}</strong>
                          </td>
                          <td className="text-muted">
                            {formatDate(r.startDate)} — {formatDate(r.endDate)}
                          </td>
                          <td>{r.total.toFixed(2)} &euro;</td>
                          <td>
                            <span className={`badge ${reservationStatusBadge(r)}`}>
                              {reservationStatusLabel(r)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={closeHistory}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab: Ficha de cliente ────────────────────────────────────────────────────

function ClienteFichaTab({ clientId }: { clientId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [client, setClient] = useState<Client | null>(null);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState<ClientFormData>(blankForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetch(`/api/clientes/${clientId}`).then((r) => r.ok ? r.json() as Promise<{ client: Client }> : null),
      fetch(`/api/clientes/${clientId}/reservas`).then((r) => r.ok ? r.json() as Promise<{ reservations: ReservationSummary[] }> : null),
      fetch('/api/clientes').then((r) => r.ok ? r.json() as Promise<{ clients: Client[] }> : null),
    ]).then(([cd, rd, all]) => {
      if (!cd) {
        setError('No se encontró el cliente');
      } else {
        setClient(cd.client);
      }
      setReservations(rd?.reservations ?? []);
      setAllClients(all?.clients ?? []);
    }).catch(() => {
      setError('Error al cargar los datos del cliente');
    }).finally(() => {
      setLoading(false);
    });
  }, [clientId]);

  function goBack() {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', 'listado');
    p.delete('clientId');
    router.push(`${pathname}?${p.toString()}`);
  }

  function openEdit() {
    if (!client) return;
    setForm(clientToForm(client));
    setFormError(null);
    setEditModal(true);
  }

  async function handleSave() {
    if (!client) return;
    setFormError(null);
    if (!form.name.trim() && form.type !== 'EMPRESA') {
      setFormError('El nombre es obligatorio');
      return;
    }
    if (form.type === 'EMPRESA' && !form.companyName.trim()) {
      setFormError('La razón social es obligatoria');
      return;
    }
    const payload = formToPayload(form, false);
    setSaving(true);
    try {
      const res = await fetch(`/api/clientes/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string; client?: Client };
      if (!res.ok) {
        setFormError(data.error ?? 'Error al guardar');
        return;
      }
      if (data.client) setClient(data.client);
      setEditModal(false);
    } finally {
      setSaving(false);
    }
  }

  const infoLabelStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 2,
  };
  const infoValueStyle: React.CSSProperties = {
    fontSize: '0.9rem',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  };
  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface-strong)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 20,
  };

  if (!clientId) {
    return (
      <div className="empty-state" style={{ marginTop: 32 }}>
        <div className="empty-state__text">Selecciona un cliente desde el Listado para ver su ficha.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ marginTop: 32 }}>
        <div className="empty-state__text">Cargando ficha...</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div style={{ marginTop: 32 }}>
        <div className="alert alert-danger">{error ?? 'Cliente no encontrado'}</div>
        <button className="btn btn-ghost btn-sm" onClick={goBack} style={{ marginTop: 12 }}>
          ← Volver al listado
        </button>
      </div>
    );
  }

  const docId = client.documentNumber ?? client.nif;
  const mainAddr = client.mainAddress;
  const localAddr = client.localAddress;

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {displayName(client)}
            </h2>
            {typeBadge(client.type) ?? <span className="badge" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>{typeLabel(client.type)}</span>}
            {client.active ? (
              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem' }}>Activo</span>
            ) : (
              <span className="badge badge-cancelada">Inactivo</span>
            )}
          </div>
          {docId && (
            <div style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {client.documentType ?? (client.type === 'EMPRESA' ? 'CIF' : 'DNI/Pasaporte')}: {docId}
            </div>
          )}
          {/* Alerts banner */}
          {client.alerts && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: 6, fontSize: '0.85rem', color: '#92400e', maxWidth: 600 }}>
              ⚠ {client.alerts}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={goBack}>← Listado</button>
          <button className="btn btn-primary btn-sm" onClick={openEdit}>Editar</button>
        </div>
      </div>

      {/* Info grid */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
          {/* Contact */}
          {client.email && (
            <div>
              <div style={infoLabelStyle}>Email</div>
              <div style={infoValueStyle}>{client.email}</div>
            </div>
          )}
          {client.phone && (
            <div>
              <div style={infoLabelStyle}>Teléfono</div>
              <div style={infoValueStyle}>{client.phone}</div>
            </div>
          )}
          {client.phone2 && (
            <div>
              <div style={infoLabelStyle}>Teléfono 2</div>
              <div style={infoValueStyle}>{client.phone2}</div>
            </div>
          )}
          {/* Identity */}
          {client.birthDate && (
            <div>
              <div style={infoLabelStyle}>Fecha nacimiento</div>
              <div style={infoValueStyle}>{formatDate(client.birthDate)}</div>
            </div>
          )}
          {client.nationality && (
            <div>
              <div style={infoLabelStyle}>Nacionalidad</div>
              <div style={infoValueStyle}>{client.nationality}</div>
            </div>
          )}
          {client.documentExpiryDate && (
            <div>
              <div style={infoLabelStyle}>Caducidad documento</div>
              <div style={infoValueStyle}>{formatDate(client.documentExpiryDate)}</div>
            </div>
          )}
          {/* License */}
          {client.licenseNumber && (
            <div>
              <div style={infoLabelStyle}>Número licencia</div>
              <div style={infoValueStyle}>{client.licenseNumber}{client.licenseType ? ` (${client.licenseType})` : ''}</div>
            </div>
          )}
          {client.licenseExpiry && (
            <div>
              <div style={infoLabelStyle}>Caducidad licencia</div>
              <div style={infoValueStyle}>{formatDate(client.licenseExpiry)}</div>
            </div>
          )}
          {/* Payment */}
          {client.paymentMethod && (
            <div>
              <div style={infoLabelStyle}>Modo de pago</div>
              <div style={infoValueStyle}>{client.paymentMethod}</div>
            </div>
          )}
          {/* Commission (COMISIONISTA) */}
          {client.type === 'COMISIONISTA' && client.commissionPercent !== undefined && (
            <div>
              <div style={infoLabelStyle}>Comisión</div>
              <div style={infoValueStyle}>{client.commissionPercent}%</div>
            </div>
          )}
        </div>

        {/* Addresses */}
        {(mainAddr || client.address) && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ ...infoLabelStyle, marginBottom: 8 }}>Dirección habitual</div>
                <div style={infoValueStyle}>
                  {[mainAddr?.street ?? client.address, mainAddr?.city ?? client.city, mainAddr?.postCode ?? client.postCode, mainAddr?.country ?? client.country].filter(Boolean).join(', ') || '—'}
                </div>
              </div>
              {localAddr && (localAddr.street || localAddr.city) && (
                <div>
                  <div style={{ ...infoLabelStyle, marginBottom: 8 }}>Dirección local</div>
                  <div style={infoValueStyle}>
                    {[localAddr.street, localAddr.city, localAddr.postCode, localAddr.country].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {client.notes && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <div style={infoLabelStyle}>Notas</div>
            <div style={{ ...infoValueStyle, whiteSpace: 'pre-wrap', marginTop: 4 }}>{client.notes}</div>
          </div>
        )}
      </div>

      {/* Reservation history */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Historial de reservas
        </h3>
        {reservations.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <div className="empty-state__text">Este cliente no tiene reservas registradas.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fechas</th>
                  <th>Matrícula</th>
                  <th>Días</th>
                  <th>Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.number}</strong></td>
                    <td className="text-muted">{formatDate(r.startDate)} — {formatDate(r.endDate)}</td>
                    <td className="text-muted">—</td>
                    <td className="text-muted">—</td>
                    <td>{r.total.toFixed(2)} €</td>
                    <td>
                      <span className={`badge ${reservationStatusBadge(r)}`}>
                        {reservationStatusLabel(r)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal__header">
              <h2 className="modal__title">Editar Cliente</h2>
              <button className="modal__close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <div className="modal__body">
              {formError && <div className="alert alert-danger">{formError}</div>}
              <ClientFormBody
                form={form}
                setForm={setForm}
                isCreate={false}
                empresaClients={allClients.filter((c) => c.type === 'EMPRESA' && c.active)}
                allClients={allClients}
              />
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setEditModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab: Histórico global ────────────────────────────────────────────────────

function ClienteHistoricoTab() {
  const [reservations, setReservations] = useState<ReservationFull[]>([]);
  const [clientMap, setClientMap] = useState<Record<string, Client>>({});
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface-strong)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 20,
  };

  const applyFilters = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterDateFrom) params.set('startFrom', filterDateFrom);
      if (filterDateTo) params.set('startTo', filterDateTo);

      const [resData, clientsData] = await Promise.all([
        fetch(`/api/reservas?${params.toString()}`).then((r) => r.ok ? r.json() as Promise<{ reservations: ReservationFull[] }> : { reservations: [] }),
        fetch('/api/clientes').then((r) => r.ok ? r.json() as Promise<{ clients: Client[] }> : { clients: [] }),
      ]);

      const map: Record<string, Client> = {};
      for (const c of clientsData.clients ?? []) map[c.id] = c;
      setClientMap(map);

      let list = resData.reservations ?? [];

      // Client-side search filter (name / DNI)
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        list = list.filter((r) => {
          const c = map[r.clientId];
          if (!c) return false;
          const hay = [c.name, c.surname, c.documentNumber, c.nif, c.companyName, c.email].filter(Boolean).join(' ').toLowerCase();
          return hay.includes(q);
        });
      }

      setReservations(list);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [filterSearch, filterDateFrom, filterDateTo, filterStatus]);

  function clientDisplayName(clientId: string): string {
    const c = clientMap[clientId];
    if (!c) return clientId;
    return displayName(c);
  }

  function clientNif(clientId: string): string {
    const c = clientMap[clientId];
    return c?.documentNumber ?? c?.nif ?? '—';
  }

  function resStatusLabel(r: ReservationFull): string {
    if (r.contractId) return 'Contratada';
    const map: Record<ReservationStatus, string> = { PETICION: 'Petición', CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada' };
    return map[r.status] ?? r.status;
  }

  function resStatusBadge(r: ReservationFull): string {
    if (r.contractId) return 'badge-contratado';
    const map: Record<ReservationStatus, string> = { PETICION: 'badge-peticion', CONFIRMADA: 'badge-confirmada', CANCELADA: 'badge-cancelada' };
    return map[r.status] ?? 'badge-cancelada';
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Buscar cliente
            </div>
            <input
              className="form-input"
              placeholder="Nombre, DNI, CIF..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ minWidth: 220 }}
            />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Desde
            </div>
            <DatePicker className="form-input" value={filterDateFrom} onChange={setFilterDateFrom} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Hasta
            </div>
            <DatePicker className="form-input" value={filterDateTo} onChange={setFilterDateTo} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Estado
            </div>
            <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="PETICION">Petición</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => void applyFilters()} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Results */}
      {!hasSearched ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '32px 0', textAlign: 'center' }}>
          Aplica los filtros para ver el histórico de reservas.
        </div>
      ) : loading ? (
        <div className="empty-state"><div className="empty-state__text">Buscando...</div></div>
      ) : reservations.length === 0 ? (
        <div className="empty-state"><div className="empty-state__text">No hay reservas que coincidan con los filtros.</div></div>
      ) : (
        <div style={cardStyle}>
          <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            {reservations.length} reserva{reservations.length !== 1 ? 's' : ''}
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>DNI / CIF</th>
                  <th>Nº Reserva</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Matrícula</th>
                  <th>Importe</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{clientDisplayName(r.clientId)}</strong></td>
                    <td className="text-muted">{clientNif(r.clientId)}</td>
                    <td><strong>{r.number}</strong></td>
                    <td className="text-muted">{formatDate(r.startDate)}</td>
                    <td className="text-muted">{formatDate(r.endDate)}</td>
                    <td className="text-muted">{r.assignedPlate ?? '—'}</td>
                    <td>{r.total.toFixed(2)} €</td>
                    <td>
                      <span className={`badge ${resStatusBadge(r)}`}>
                        {resStatusLabel(r)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Promociones y descuentos ────────────────────────────────────────────

interface PromoFormData {
  code: string;
  description: string;
  discountType: DiscountType | '';
  discountValue: string;
  scope: PromoScope | '';
  validFrom: string;
  validTo: string;
  maxUses: string;
  active: boolean;
}

function blankPromoForm(): PromoFormData {
  return {
    code: '',
    description: '',
    discountType: 'PERCENT',
    discountValue: '',
    scope: 'ALL',
    validFrom: '',
    validTo: '',
    maxUses: '',
    active: true,
  };
}

function PromocionesTab() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterActive, setFilterActive] = useState(true);
  const [filterScope, setFilterScope] = useState('');

  // Modal
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoFormData>(blankPromoForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/promocodes');
      if (res.ok) {
        const data = await res.json() as { promoCodes: PromoCode[] };
        setPromoCodes(data.promoCodes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = promoCodes.filter((p) => {
    if (filterActive && !p.active) return false;
    if (filterScope && p.scope !== filterScope) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!p.code.toLowerCase().includes(q) && !(p.description?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  function openCreate() {
    setForm(blankPromoForm());
    setEditingId(null);
    setFormError(null);
    setModal('create');
  }

  function openEdit(p: PromoCode) {
    setForm({
      code: p.code,
      description: p.description ?? '',
      discountType: p.discountType,
      discountValue: String(p.discountValue),
      scope: p.scope,
      validFrom: p.validFrom ?? '',
      validTo: p.validTo ?? '',
      maxUses: p.maxUses !== undefined ? String(p.maxUses) : '',
      active: p.active,
    });
    setEditingId(p.id);
    setFormError(null);
    setModal('edit');
  }

  async function handleSave() {
    setFormError(null);
    if (!form.code.trim()) { setFormError('El código es obligatorio'); return; }
    if (!form.discountType) { setFormError('El tipo de descuento es obligatorio'); return; }
    const dv = parseFloat(form.discountValue);
    if (isNaN(dv) || dv < 0) { setFormError('El valor del descuento debe ser un número positivo'); return; }

    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue: dv,
      scope: form.scope || 'ALL',
      validFrom: form.validFrom || undefined,
      validTo: form.validTo || undefined,
      maxUses: form.maxUses !== '' ? parseInt(form.maxUses, 10) : undefined,
      active: form.active,
    };

    setSaving(true);
    try {
      const url = modal === 'edit' && editingId ? `/api/promocodes/${editingId}` : '/api/promocodes';
      const method = modal === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setFormError(data.error ?? 'Error al guardar'); return; }
      setModal(null);
      void fetchPromos();
      setHasSearched(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: PromoCode) {
    if (!confirm(`Eliminar código "${p.code}"?`)) return;
    await fetch(`/api/promocodes/${p.id}`, { method: 'DELETE' });
    void fetchPromos();
  }

  function scopeLabel(s: PromoScope): string {
    const m: Record<PromoScope, string> = { ALL: 'Todos', CATEGORY: 'Categoría', CLIENT: 'Cliente', COMISIONISTA: 'Comisionista' };
    return m[s] ?? s;
  }

  return (
    <div>
      {/* Filters */}
      <div className="filters-bar">
        <input
          className="form-input"
          placeholder="Buscar código o descripción..."
          value={filterSearch}
          onChange={(e) => { setFilterSearch(e.target.value); setHasSearched(true); }}
          style={{ minWidth: 220 }}
        />
        <select className="form-select" value={filterScope} onChange={(e) => { setFilterScope(e.target.value); setHasSearched(true); }}>
          <option value="">Todos los ámbitos</option>
          <option value="ALL">Todos</option>
          <option value="CATEGORY">Categoría</option>
          <option value="CLIENT">Cliente</option>
          <option value="COMISIONISTA">Comisionista</option>
        </select>
        <label className={styles.filterCheckbox}>
          <input type="checkbox" checked={filterActive} onChange={(e) => { setFilterActive(e.target.checked); setHasSearched(true); }} />
          Solo activos
        </label>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { void fetchPromos(); setHasSearched(true); }}
          disabled={loading}
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + Nueva promoción
        </button>
      </div>

      {!hasSearched ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>
          Haz clic en Actualizar para cargar las promociones.
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-state__text">No hay códigos promocionales que coincidan.</div></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Ámbito</th>
                <th>Válido desde</th>
                <th>Válido hasta</th>
                <th>Usos</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td><strong style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>{p.code}</strong></td>
                  <td className="text-muted">{p.description ?? '—'}</td>
                  <td className="text-muted">{p.discountType === 'PERCENT' ? '%' : '€ fijo'}</td>
                  <td>{p.discountType === 'PERCENT' ? `${p.discountValue}%` : `${p.discountValue.toFixed(2)} €`}</td>
                  <td className="text-muted">{scopeLabel(p.scope)}</td>
                  <td className="text-muted">{p.validFrom ? formatDate(p.validFrom) : '—'}</td>
                  <td className="text-muted">{p.validTo ? formatDate(p.validTo) : '—'}</td>
                  <td className="text-muted">{p.usedCount}{p.maxUses !== undefined ? ` / ${p.maxUses}` : ''}</td>
                  <td>
                    {p.active
                      ? <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem' }}>Activo</span>
                      : <span className="badge badge-cancelada">Inactivo</span>
                    }
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(p)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal__header">
              <h2 className="modal__title">{modal === 'create' ? 'Nueva promoción' : 'Editar promoción'}</h2>
              <button className="modal__close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal__body">
              {formError && <div className="alert alert-danger">{formError}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input
                    className="form-input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Ej. VERANO20"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={form.active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Descripción</label>
                  <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de descuento *</label>
                  <select className="form-select" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as DiscountType })}>
                    <option value="PERCENT">Porcentaje (%)</option>
                    <option value="FIXED">Importe fijo (€)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    min={0}
                    step={0.01}
                    placeholder={form.discountType === 'PERCENT' ? 'Ej. 20 (= 20%)' : 'Ej. 10 (= 10 €)'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ámbito</label>
                  <select className="form-select" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as PromoScope })}>
                    <option value="ALL">Todos</option>
                    <option value="CATEGORY">Categoría específica</option>
                    <option value="CLIENT">Cliente específico</option>
                    <option value="COMISIONISTA">Comisionista específico</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Máx. usos</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    min={1}
                    placeholder="Ilimitado"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Válido desde</label>
                  <DatePicker className="form-input" value={form.validFrom} onChange={(v) => setForm({ ...form, validFrom: v })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Válido hasta</label>
                  <DatePicker className="form-input" value={form.validTo} onChange={(v) => setForm({ ...form, validTo: v })} />
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab wrapper ──────────────────────────────────────────────────────────

const CLIENTES_TABS = [
  { key: 'listado',     label: 'Listados' },
  { key: 'ficha',       label: 'Ficha de cliente' },
  { key: 'historico',   label: 'Históricos' },
  { key: 'promociones', label: 'Promociones y descuentos' },
];

function ClientesTabNav({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 24 }}>
      {CLIENTES_TABS.map((t) => (
        <button key={t.key} type="button" onClick={() => go(t.key)} style={{ flex: 1, textAlign: 'center', padding: '7px 8px', fontSize: '0.82rem', fontWeight: active === t.key ? 600 : 500, color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)', background: active === t.key ? 'var(--color-surface-strong)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function ClientesInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'listado';
  const clientId = searchParams.get('clientId') ?? '';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{CLIENTES_TABS.find((t) => t.key === tab)?.label ?? tab}</p>
        </div>
        {tab === 'listado' && <PrintButton />}
      </div>
      <ClientesTabNav active={tab} />
      {tab === 'listado' && <ClientesContent />}
      {tab === 'ficha' && <ClienteFichaTab clientId={clientId} />}
      {tab === 'historico' && <ClienteHistoricoTab />}
      {tab === 'promociones' && <PromocionesTab />}
      {tab !== 'listado' && tab !== 'ficha' && tab !== 'historico' && tab !== 'promociones' && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-state__icon">🚧</div>
          <div className="empty-state__text">{CLIENTES_TABS.find((t) => t.key === tab)?.label ?? tab} — Próximamente</div>
        </div>
      )}
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense>
      <ClientesInner />
    </Suspense>
  );
}
