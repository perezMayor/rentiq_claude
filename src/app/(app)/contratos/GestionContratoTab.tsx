'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Client, VehicleCategory, CompanyBranch, TariffPlan, FleetVehicle } from '@/src/lib/types';
import styles from '../reservas/gestion.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  branchId: string;
  clientId: string;
  plate: string;
  categoryId: string;
  pickupLocation: string;
  returnLocation: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  flightIn: string;
  flightOut: string;
  billedDays: string;
  tariffPlanId: string;
  basePrice: string;
  discount: string;
  insuranceTotal: string;
  franchise: string;
  extrasTotal: string;
  fuelCharge: string;
  deposit: string;
  extension: string;
  total: string;
  credit: string;
  notesPublic: string;
  notesPrivate: string;
  lockPlate: boolean;
  vehicleTabIn: 'seguros' | 'extras';
  notesTab: 'publicas' | 'privadas' | 'conductores';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function blankForm(branches: CompanyBranch[], categories: VehicleCategory[]): FormState {
  return {
    branchId: branches[0]?.id ?? '',
    clientId: '',
    plate: '',
    categoryId: categories[0]?.id ?? '',
    pickupLocation: '',
    returnLocation: '',
    startDate: today(),
    startTime: nowTime(),
    endDate: today(),
    endTime: nowTime(),
    flightIn: '',
    flightOut: '',
    billedDays: '1',
    tariffPlanId: '',
    basePrice: '0',
    discount: '0',
    insuranceTotal: '0',
    franchise: '0',
    extrasTotal: '0',
    fuelCharge: '0',
    deposit: '0',
    extension: '0',
    total: '0',
    credit: '0',
    notesPublic: '',
    notesPrivate: '',
    lockPlate: false,
    vehicleTabIn: 'seguros',
    notesTab: 'publicas',
  };
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={styles.toggleLabel}>
      <span>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative',
          background: value ? 'var(--color-primary)' : 'var(--color-border)',
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </div>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GestionContratoTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [tariffs, setTariffs] = useState<TariffPlan[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);

  const [form, setForm] = useState<FormState>(() => blankForm([], []));
  const [clientSearch, setClientSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    async function load() {
      const [clientsRes, catRes, brRes, tarRes] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/categorias'),
        fetch('/api/sucursales'),
        fetch('/api/tarifas').catch(() => null),
      ]);
      const clientsData = clientsRes.ok ? (await clientsRes.json()).clients    ?? [] : [];
      const catData     = catRes.ok     ? (await catRes.json()).categories      ?? [] : [];
      const brData      = brRes.ok      ? (await brRes.json()).branches         ?? [] : [];
      const tarData     = tarRes?.ok    ? (await tarRes.json()).plans           ?? [] : [];
      setClients(clientsData);
      setCategories(catData);
      setBranches(brData);
      setTariffs(tarData);
      setForm(blankForm(brData, catData));
    }
    load();
  }, []);

  useEffect(() => {
    if (!form.categoryId) return;
    fetch(`/api/vehiculos/flota?active=true&categoryId=${form.categoryId}`)
      .then((r) => r.ok ? r.json() : { vehicles: [] })
      .then((d) => setVehicles(d.vehicles ?? []));
  }, [form.categoryId]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return [];
    return clients.filter((c) =>
      `${c.name} ${c.surname ?? ''}`.toLowerCase().includes(q) ||
      (c.nif ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [clientSearch, clients]);

  const selectedClient = clients.find((c) => c.id === form.clientId);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function recalcTotal(updated?: Partial<FormState>) {
    const f = { ...form, ...updated };
    const base = parseFloat(f.basePrice) || 0;
    const disc = parseFloat(f.discount) || 0;
    const ins  = parseFloat(f.insuranceTotal) || 0;
    const ext  = parseFloat(f.extrasTotal) || 0;
    const fuel = parseFloat(f.fuelCharge) || 0;
    const extn = parseFloat(f.extension) || 0;
    setForm((prev) => ({ ...prev, ...updated, total: (base - disc + ins + ext + fuel + extn).toFixed(2) }));
  }

  function handleNumBlur(field: keyof FormState) {
    recalcTotal({ [field]: form[field] } as Partial<FormState>);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId:       form.branchId,
          clientId:       form.clientId,
          plate:          form.plate,
          categoryId:     form.categoryId,
          pickupLocation: form.pickupLocation,
          returnLocation: form.returnLocation,
          startDate:      form.startDate,
          startTime:      form.startTime,
          endDate:        form.endDate,
          endTime:        form.endTime,
          billedDays:     parseInt(form.billedDays) || 1,
          basePrice:      parseFloat(form.basePrice)      || 0,
          extrasTotal:    parseFloat(form.extrasTotal)    || 0,
          insuranceTotal: parseFloat(form.insuranceTotal) || 0,
          fuelCharge:     parseFloat(form.fuelCharge)     || 0,
          penalties:      0,
          discount:       parseFloat(form.discount)       || 0,
          total:          parseFloat(form.total)          || 0,
          notes:          form.notesPrivate || form.notesPublic || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Error al guardar');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setForm(blankForm(branches, categories));
      setClientSearch('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setForm(blankForm(branches, categories));
    setClientSearch('');
    setError('');
  }

  return (
    <form onSubmit={handleSubmit} className={styles.gestion}>

      {/* ── Top bar ── */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button type="button" className="btn btn-ghost btn-sm">Crear cliente</button>
        </div>
        <input className={styles.numInput} placeholder="Nº contrato" readOnly value="" />
      </div>

      {/* ── Help ── */}
      <div className={styles.helpBar} onClick={() => setShowHelp((v) => !v)}>
        <span>{showHelp ? '▼' : '▶'}</span>
        <span>? Ayuda rápida de Contratos</span>
      </div>
      {showHelp && (
        <div style={{ padding: '10px 14px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          Rellena todos los campos para crear un contrato directo sin reserva previa. La matrícula es obligatoria. Una vez creado, el contrato queda en estado <strong>Abierto</strong>.
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {saved && <div className="alert alert-success">Contrato creado correctamente.</div>}

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* ═══ Left ═══ */}
        <div className={styles.mainCol}>

          {/* Cliente */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Cliente</div>
            <div className={styles.cardBody}>
              <div className={`${styles.searchWrap} ${styles.full}`}>
                <input
                  className="form-input"
                  placeholder="Buscar cliente — Nombre, documento, email, teléfono o código"
                  value={selectedClient ? `${selectedClient.name}${selectedClient.surname ? ' ' + selectedClient.surname : ''}` : clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); set('clientId', ''); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)}
                  onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                  autoComplete="off"
                />
                {showSearch && filteredClients.length > 0 && (
                  <div className={styles.searchResults}>
                    {filteredClients.map((c) => (
                      <div key={c.id} className={styles.searchItem} onMouseDown={() => { set('clientId', c.id); setClientSearch(''); setShowSearch(false); }}>
                        <span className={styles.searchItemMain}>{c.name}{c.surname ? ' ' + c.surname : ''}</span>
                        <span className={styles.searchItemSub}>{[c.nif, c.email, c.phone].filter(Boolean).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.grid2}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">ID cliente</label>
                  <input className="form-input" readOnly value={selectedClient?.id ?? ''} placeholder="Código cliente" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Cliente *</label>
                  <select className="form-select" value={form.clientId} onChange={(e) => { set('clientId', e.target.value); setClientSearch(''); }} required>
                    <option value="">— Seleccionar —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.surname ? ' ' + c.surname : ''}{c.nif ? ` (${c.nif})` : ''}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Empresa</label>
                  <input className="form-input" readOnly value={selectedClient?.type === 'EMPRESA' ? (selectedClient.companyName ?? selectedClient.name) : ''} placeholder="—" style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Comisionista</label>
                  <input className="form-input" readOnly value={selectedClient?.type === 'COMISIONISTA' ? selectedClient.name : ''} placeholder="—" style={{ color: 'var(--color-text-muted)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Entrega y recogida */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Entrega y recogida</div>
            <div className={styles.cardBody}>
              <div className={styles.grid2}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Sucursal entrega *</label>
                  <select className="form-select" value={form.branchId} onChange={(e) => set('branchId', e.target.value)} required>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Lugar entrega</label>
                  <input className="form-input" value={form.pickupLocation} onChange={(e) => set('pickupLocation', e.target.value)} placeholder="Dirección o punto de entrega" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fecha/hora entrega *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" className="form-input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} required style={{ flex: 1 }} />
                    <input type="time" className="form-input" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required style={{ width: 90 }} />
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vuelo entrega</label>
                  <input className="form-input" value={form.flightIn} onChange={(e) => set('flightIn', e.target.value)} placeholder="IB1234" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Sucursal recogida</label>
                  <select className="form-select" value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} · ` : ''}{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Lugar recogida</label>
                  <input className="form-input" value={form.returnLocation} onChange={(e) => set('returnLocation', e.target.value)} placeholder="Dirección o punto de recogida" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fecha/hora recogida *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="date" className="form-input" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} required style={{ flex: 1 }} />
                    <input type="time" className="form-input" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} required style={{ width: 90 }} />
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Vuelo recogida</label>
                  <input className="form-input" value={form.flightOut} onChange={(e) => set('flightOut', e.target.value)} placeholder="IB5678" />
                </div>
              </div>
            </div>
          </div>

          {/* Vehículo */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Vehículo</div>
            <div className={styles.cardBody}>
              <div className={styles.vehiculoTop}>
                <div className={styles.grid3} style={{ flex: 1 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Grupo reservado *</label>
                    <select className="form-select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
                      <option value="">— Selecciona —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Grupo entregado</label>
                    <select className="form-select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                      <option value="">— Selecciona —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Matrícula *</label>
                    <select
                      className="form-select"
                      value={form.plate}
                      onChange={(e) => set('plate', e.target.value)}
                      required
                      disabled={form.lockPlate}
                    >
                      <option value="">— Selecciona —</option>
                      {vehicles.map((v) => <option key={v.id} value={v.plate}>{v.plate}</option>)}
                    </select>
                  </div>
                </div>
                <Toggle value={form.lockPlate} onChange={(v) => set('lockPlate', v)} label="Bloquear matr." />
              </div>

              <div>
                <div className={styles.innerTabs}>
                  {(['seguros', 'extras'] as const).map((t) => (
                    <button key={t} type="button" className={`${styles.innerTab} ${form.vehicleTabIn === t ? styles.innerTabActive : ''}`} onClick={() => set('vehicleTabIn', t)}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                {form.vehicleTabIn === 'seguros' && (
                  <div className={styles.seguroRow}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Seguro</label>
                      <select className="form-select"><option>Ninguno</option></select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Unidades</label>
                      <input type="number" className="form-input" defaultValue={1} min={1} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Precio ud.</label>
                      <input type="number" className="form-input" defaultValue="0.00" step="0.01" min={0} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Total</label>
                      <input type="number" className="form-input" defaultValue="0.00" readOnly style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                    <div className={styles.franquiciaToggle}>
                      <span>Franquicia</span>
                      <div style={{ width: 36, height: 20, borderRadius: 10, background: 'var(--color-primary)', position: 'relative', cursor: 'pointer' }}>
                        <div style={{ position: 'absolute', top: 2, left: 18, width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
                      </div>
                    </div>
                  </div>
                )}
                {form.vehicleTabIn === 'extras' && (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', padding: '8px 0' }}>Sin extras añadidos.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Right: Liquidación ═══ */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>Liquidación</div>
          <div className={styles.liquidacion}>
            <div className={styles.liqRow}>
              <span className={styles.liqLabel}>Días facturados</span>
              <input className={styles.liqInput} type="number" min={1} value={form.billedDays} onChange={(e) => set('billedDays', e.target.value)} />
            </div>
            <div className={styles.liqRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <span className={styles.liqLabel}>Tarifa</span>
              <select className={styles.liqSelect} value={form.tariffPlanId} onChange={(e) => set('tariffPlanId', e.target.value)}>
                <option value="">— Seleccionar tarifa —</option>
                {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {([
              { label: 'Alquiler',    field: 'basePrice'      },
              { label: 'Descuento',   field: 'discount'       },
              { label: 'Seguro',      field: 'insuranceTotal' },
              { label: 'Franquicia',  field: 'franchise'      },
              { label: 'Extras',      field: 'extrasTotal'    },
              { label: 'Combustible', field: 'fuelCharge'     },
              { label: 'Fianza',      field: 'deposit'        },
              { label: 'Extensión',   field: 'extension'      },
            ] as { label: string; field: keyof FormState }[]).map(({ label, field }) => (
              <div key={field} className={styles.liqRow}>
                <span className={styles.liqLabel}>{label}</span>
                <input className={styles.liqInput} type="number" min={0} step="0.01" value={form[field] as string} onChange={(e) => set(field, e.target.value)} onBlur={() => handleNumBlur(field)} />
              </div>
            ))}
            <div className={styles.liqTotal}>
              <div className={styles.liqTotalLabel}>Total</div>
              <div className={styles.liqTotalValue}>{parseFloat(form.total).toFixed(2)} €</div>
            </div>
            <div className={styles.liqRow}>
              <span className={styles.liqLabel}>Crédito</span>
              <input className={styles.liqInput} type="number" min={0} step="0.01" value={form.credit} onChange={(e) => set('credit', e.target.value)} />
            </div>
            <div className={styles.liqRow}>
              <span className={styles.liqLabel}>Pagos realizados</span>
              <input className={styles.liqInput} type="number" readOnly value="0.00" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <div className={styles.liqTotal} style={{ background: 'var(--color-primary)', borderTop: 'none' }}>
              <div className={styles.liqTotalLabel} style={{ color: 'rgba(255,255,255,0.7)' }}>Total a pagar</div>
              <div className={styles.liqTotalValue} style={{ color: '#fff', fontSize: '1.6rem' }}>{parseFloat(form.total).toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      <div className={styles.notesCard}>
        <div className={styles.notesTabs}>
          {(['publicas', 'privadas', 'conductores'] as const).map((t) => (
            <button key={t} type="button" className={`${styles.notesTab} ${form.notesTab === t ? styles.notesTabActive : ''}`} onClick={() => set('notesTab', t)}>
              {t === 'publicas' ? 'Notas públicas' : t === 'privadas' ? 'Notas privadas' : 'Conductores adicionales'}
            </button>
          ))}
        </div>
        <div className={styles.notesBody}>
          {form.notesTab === 'publicas'  && <textarea className={styles.notesTextarea} value={form.notesPublic}  onChange={(e) => set('notesPublic',  e.target.value)} placeholder="Notas visibles en documentos…" />}
          {form.notesTab === 'privadas'  && <textarea className={styles.notesTextarea} value={form.notesPrivate} onChange={(e) => set('notesPrivate', e.target.value)} placeholder="Notas internas…" />}
          {form.notesTab === 'conductores' && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', padding: '8px 0' }}>Sin conductores adicionales.</div>}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className={styles.actionBar}>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar contrato'}</button>
        <button type="button" className="btn btn-ghost" onClick={handleClear}>Limpiar campos</button>
        <button type="button" className="btn btn-ghost">Bloquear precios</button>
        <div className={styles.actionBarRight}>
          <button type="button" className="btn btn-ghost">Disponibilidad</button>
          <button type="button" className="btn btn-ghost">Auditoría</button>
        </div>
      </div>

    </form>
  );
}
