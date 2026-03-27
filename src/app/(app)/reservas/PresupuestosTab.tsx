'use client';

import { useState, useEffect, useMemo } from 'react';
import type {
  TariffPlan,
  TariffBracket,
  TariffPrice,
  TariffCellType,
  VehicleCategory,
  VehicleExtra,
  VehicleInsurance,
} from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import styles from './gestion.module.css';
import ExtrasTabContent, { type FormExtra, type NightFeeConfig } from './ExtrasTabContent';
import SegurosTabContent, { type FormInsurance } from './SegurosTabContent';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanDetail {
  brackets: TariffBracket[];
  prices: TariffPrice[];
}

interface FormState {
  clientName: string;
  clientEmail: string;
  clientLanguage: string;
  nightFeeApplied: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  categoryId: string;
  tariffPlanId: string;
  billedDays: string;
  basePrice: string;
  discount: string;
  insuranceTotal: string;
  franchise: string;
  extrasTotal: string;
  fuelCharge: string;
  total: string;
  notes: string;
  vehicleTabIn: 'seguros' | 'extras';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function calcBilledDays(start: string, end: string): number {
  if (!start || !end) return 1;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const d = Math.round(ms / 86400000);
  return d > 0 ? d : 1;
}

function planCovers(plan: TariffPlan, start: string, end: string): boolean {
  return plan.active && plan.validFrom <= end && plan.validTo >= start;
}

function findBracket(brackets: TariffBracket[], days: number): TariffBracket | null {
  // Sort ascending, find the largest bracket whose minDays <= days (proration reference)
  const sorted = brackets
    .filter((b) => !b.isExtraDay)
    .sort((a, b) => a.minDays - b.minDays);
  let match: TariffBracket | null = null;
  for (const b of sorted) {
    if (b.minDays <= days) match = b;
    else break;
  }
  return match ?? sorted[0] ?? null;
}

function calcBaseFromCell(cell: TariffPrice | undefined, days: number, bracketDays?: number): number {
  if (!cell) return 0;
  const t: TariffCellType = cell.pricingType ?? 'DIA';
  if (t === 'LIBRE') return 0;
  if (t === 'DIA' || t === 'DIA_KM') return Math.round(cell.price * days * 100) / 100;
  if (t === 'FIJO') {
    const refDays = bracketDays && bracketDays > 0 ? bracketDays : days;
    return Math.round((cell.price / refDays) * days * 100) / 100;
  }
  return 0;
}

function blankForm(): FormState {
  const start = today();
  const end   = tomorrow();
  return {
    clientName:     '',
    clientEmail:    '',
    clientLanguage: 'es',
    nightFeeApplied: false,
    startDate:      start,
    startTime:      '09:00',
    endDate:        end,
    endTime:        '09:00',
    categoryId:     '',
    tariffPlanId:   '',
    billedDays:     '1',
    basePrice:      '0',
    discount:       '0',
    insuranceTotal: '0',
    franchise:      '0',
    extrasTotal:    '0',
    fuelCharge:     '0',
    total:          '0',
    notes:          '',
    vehicleTabIn:   'seguros',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PresupuestosTab() {
  const [plans, setPlans]           = useState<TariffPlan[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [catalogExtras, setCatalogExtras]         = useState<VehicleExtra[]>([]);
  const [catalogInsurances, setCatalogInsurances] = useState<VehicleInsurance[]>([]);
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [formExtras, setFormExtras]         = useState<FormExtra[]>([]);
  const [formInsurances, setFormInsurances] = useState<FormInsurance[]>([]);
  const [nightFeeConfig, setNightFeeConfig] = useState<NightFeeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [form, setForm] = useState<FormState>(blankForm);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ── Load data ──

  useEffect(() => {
    Promise.all([
      fetch('/api/tarifas').catch(() => null),
      fetch('/api/vehiculos/categorias').catch(() => null),
      fetch('/api/vehiculos/extras').catch(() => null),
      fetch('/api/vehiculos/seguros').catch(() => null),
      fetch('/api/gestor/empresa').catch(() => null),
    ]).then(([t, c, e, s, g]) => {
      Promise.all([
        t?.ok ? t.json() : Promise.resolve({}),
        c?.ok ? c.json() : Promise.resolve({}),
        e?.ok ? e.json() : Promise.resolve({}),
        s?.ok ? s.json() : Promise.resolve({}),
        g?.ok ? g.json() : Promise.resolve({}),
      ]).then(([td, cd, ed, sd, gd]) => {
        setPlans((td.plans ?? []).filter((p: TariffPlan) => p.active));
        setCategories((cd.categories ?? []).filter((x: VehicleCategory) => x.active));
        setCatalogExtras((ed.extras ?? []).filter((x: VehicleExtra) => x.active));
        setCatalogInsurances((sd.insurances ?? []).filter((x: VehicleInsurance) => x.active));
        const cfg = gd.settings ?? {};
        if (cfg.nightFeePrice != null && cfg.nightFeeFromHour != null && cfg.nightFeeToHour != null) {
          setNightFeeConfig({ price: cfg.nightFeePrice, fromHour: cfg.nightFeeFromHour, toHour: cfg.nightFeeToHour });
        }
      });
    }).finally(() => setLoading(false));
  }, []);

  // ── Auto-select plan when dates change ──

  useEffect(() => {
    if (!form.startDate || !form.endDate) return;
    const matching = plans.filter((p) => planCovers(p, form.startDate, form.endDate));
    if (matching.length === 1 && matching[0].id !== form.tariffPlanId) {
      setForm((prev) => ({ ...prev, tariffPlanId: matching[0].id }));
    } else if (matching.length === 0) {
      setForm((prev) => ({ ...prev, tariffPlanId: '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.endDate, plans]);

  // ── Load plan detail when plan changes ──

  useEffect(() => {
    if (!form.tariffPlanId) { setPlanDetail(null); return; }
    fetch(`/api/tarifas/${form.tariffPlanId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d ? setPlanDetail({ brackets: d.brackets ?? [], prices: d.prices ?? [] }) : setPlanDetail(null))
      .catch(() => setPlanDetail(null));
  }, [form.tariffPlanId]);

  // ── Auto-calculate base price when plan/category/days change ──

  const matchedBracket = useMemo(() => {
    if (!planDetail) return null;
    return findBracket(planDetail.brackets, parseInt(form.billedDays) || 1);
  }, [planDetail, form.billedDays]);

  const priceCell = useMemo(() => {
    if (!planDetail || !matchedBracket || !form.categoryId) return undefined;
    return planDetail.prices.find(
      (p) => p.bracketId === matchedBracket.id && p.categoryId === form.categoryId,
    );
  }, [planDetail, matchedBracket, form.categoryId]);

  useEffect(() => {
    const days = parseInt(form.billedDays) || 1;
    const base = calcBaseFromCell(priceCell, days, matchedBracket?.minDays);
    setForm((prev) => {
      const disc  = parseFloat(prev.discount)       || 0;
      const ins   = parseFloat(prev.insuranceTotal) || 0;
      const ext   = parseFloat(prev.extrasTotal)    || 0;
      const fuel  = parseFloat(prev.fuelCharge)     || 0;
      const total = Math.max(0, base - disc + ins + ext + fuel);
      return { ...prev, basePrice: base.toFixed(2), total: total.toFixed(2) };
    });
  }, [priceCell, form.billedDays]);

  // ── Sync extras total ──

  useEffect(() => {
    const total = formExtras.reduce((s, e) => s + e.total, 0);
    setForm((prev) => {
      const base  = parseFloat(prev.basePrice)      || 0;
      const disc  = parseFloat(prev.discount)       || 0;
      const ins   = parseFloat(prev.insuranceTotal) || 0;
      const fuel  = parseFloat(prev.fuelCharge)     || 0;
      const grand = Math.max(0, base - disc + ins + total + fuel);
      return { ...prev, extrasTotal: total.toFixed(2), total: grand.toFixed(2) };
    });
  }, [formExtras]);

  // ── Recalculate PER_DAY extras when billedDays changes ──

  useEffect(() => {
    const days = parseInt(form.billedDays) || 1;
    setFormExtras((prev) =>
      prev.map((e) =>
        e.pricingMode === 'PER_DAY'
          ? { ...e, total: Math.round(e.unitPrice * e.quantity * Math.min(days, e.maxDays ?? days) * 100) / 100 }
          : e
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.billedDays]);

  // ── Sync insurances total ──

  useEffect(() => {
    const total = formInsurances.reduce((s, i) => s + i.total, 0);
    setForm((prev) => {
      const base  = parseFloat(prev.basePrice)  || 0;
      const disc  = parseFloat(prev.discount)   || 0;
      const ext   = parseFloat(prev.extrasTotal)|| 0;
      const fuel  = parseFloat(prev.fuelCharge) || 0;
      const grand = Math.max(0, base - disc + total + ext + fuel);
      return { ...prev, insuranceTotal: total.toFixed(2), total: grand.toFixed(2) };
    });
  }, [formInsurances]);

  // ── Recalculate PER_DAY insurances when billedDays changes ──

  useEffect(() => {
    const days = parseInt(form.billedDays) || 1;
    setFormInsurances((prev) =>
      prev.map((i) =>
        i.pricingMode === 'PER_DAY'
          ? { ...i, total: Math.round(i.unitPrice * i.quantity * Math.min(days, i.maxDays ?? days) * 100) / 100 }
          : i
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.billedDays]);

  // ── Auto-compute tariff price when dates/category/billedDays change ──────
  useEffect(() => {
    void computeTariffPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.endDate, form.categoryId, form.billedDays]);

  function recalcTotal(updated?: Partial<FormState>) {
    const f = { ...form, ...updated };
    const base  = parseFloat(f.basePrice)       || 0;
    const disc  = parseFloat(f.discount)        || 0;
    const ins   = parseFloat(f.insuranceTotal)  || 0;
    const ext   = parseFloat(f.extrasTotal)     || 0;
    const fuel  = parseFloat(f.fuelCharge)      || 0;
    const night = (f.nightFeeApplied && nightFeeConfig) ? nightFeeConfig.price : 0;
    const total = Math.max(0, base - disc + ins + ext + fuel + night);
    setForm((prev) => ({ ...prev, ...updated, total: total.toFixed(2) }));
  }

  function handleNumBlur(field: keyof FormState) {
    recalcTotal({ [field]: form[field] } as Partial<FormState>);
  }

  async function computeTariffPrice() {
    if (!form.startDate || !form.endDate || !form.categoryId) return;
    const days = parseInt(form.billedDays) || 1;
    try {
      const res = await fetch('/api/tarifas/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: form.startDate, endDate: form.endDate, totalDays: days, categoryId: form.categoryId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.total > 0) {
        setForm((prev) => ({ ...prev, basePrice: String(data.total) }));
        recalcTotal({ basePrice: String(data.total) });
      }
    } catch { /* silently ignore — user can set manually */ }
  }

  function handleClear() {
    setForm(blankForm());
    setFormExtras([]);
    setFormInsurances([]);
    setPlanDetail(null);
    setEmailFeedback(null);
  }

  async function handleSendEmail() {
    if (!form.clientEmail) return;
    setSendingEmail(true);
    setEmailFeedback(null);
    try {
      const res = await fetch('/api/email/presupuesto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName:     form.clientName,
          clientEmail:    form.clientEmail,
          language:       form.clientLanguage,
          startDate:      form.startDate,
          startTime:      form.startTime,
          endDate:        form.endDate,
          endTime:        form.endTime,
          billedDays:     parseInt(form.billedDays) || 1,
          categoryId:     form.categoryId,
          basePrice:      parseFloat(form.basePrice) || 0,
          discount:       parseFloat(form.discount) || 0,
          insuranceTotal: parseFloat(form.insuranceTotal) || 0,
          extrasTotal:    parseFloat(form.extrasTotal) || 0,
          fuelCharge:     parseFloat(form.fuelCharge) || 0,
          total:          parseFloat(form.total) || 0,
          notes:          form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar');
      setEmailFeedback({ ok: true, msg: `Presupuesto enviado a ${form.clientEmail}` });
    } catch (err) {
      setEmailFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Error desconocido' });
    } finally {
      setSendingEmail(false);
    }
  }

  const matchingPlans = plans.filter((p) => planCovers(p, form.startDate, form.endDate));

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>Cargando datos…</div>;
  }

  return (
    <div className={styles.gestion}>

      {/* ── Top bar ── */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Cálculo de presupuesto orientativo
          </span>
        </div>
      </div>

      {/* ── Body: left + right ── */}
      <div className={styles.body}>

        {/* ═══ Left column ═══ */}
        <div className={styles.mainCol}>

          {/* ── Card: Cliente y período ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Cliente y período</div>
            <div className={styles.cardBody}>
              <div className={styles.grid2}>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nombre del cliente</label>
                  <input
                    className="form-input"
                    value={form.clientName}
                    onChange={(e) => set('clientName', e.target.value)}
                    placeholder="Nombre del solicitante (opcional)"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email del cliente</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="email"
                      className="form-input"
                      value={form.clientEmail}
                      onChange={(e) => set('clientEmail', e.target.value)}
                      placeholder="correo@ejemplo.com"
                      style={{ flex: 1 }}
                    />
                    <select
                      className="form-select"
                      value={form.clientLanguage}
                      onChange={(e) => set('clientLanguage', e.target.value)}
                      style={{ width: 80 }}
                      title="Idioma del presupuesto"
                    >
                      <option value="es">ES</option>
                      <option value="en">EN</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fecha/hora entrega *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <DatePicker
                      value={form.startDate}
                      onChange={(d) => {
                        const days = calcBilledDays(d, form.endDate);
                        setForm((p) => ({ ...p, startDate: d, billedDays: String(days) }));
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="time"
                      className="form-input"
                      value={form.startTime}
                      onChange={(e) => set('startTime', e.target.value)}
                      style={{ width: 90 }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fecha/hora recogida *</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <DatePicker
                      value={form.endDate}
                      onChange={(d) => {
                        const days = calcBilledDays(form.startDate, d);
                        setForm((p) => ({ ...p, endDate: d, billedDays: String(days) }));
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="time"
                      className="form-input"
                      value={form.endTime}
                      onChange={(e) => set('endTime', e.target.value)}
                      style={{ width: 90 }}
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── Card: Vehículo ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>Vehículo</div>
            <div className={styles.cardBody}>

              <div className={styles.grid2}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Grupo reservado *</label>
                  <select
                    className="form-select"
                    value={form.categoryId}
                    onChange={(e) => set('categoryId', e.target.value)}
                  >
                    <option value="">— Selecciona —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tarifa</label>
                  <select
                    className="form-select"
                    value={form.tariffPlanId}
                    onChange={(e) => set('tariffPlanId', e.target.value)}
                  >
                    <option value="">— Sin tarifa —</option>
                    {matchingPlans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                    {matchingPlans.length === 0 && (
                      <option disabled value="">No hay tarifas para estas fechas</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Tramo aplicado */}
              {matchedBracket && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 10px', fontSize: '0.78rem',
                  background: 'rgba(43,108,189,0.05)',
                  border: '1px solid rgba(43,108,189,0.15)',
                  borderRadius: 5, color: 'var(--color-text-muted)',
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                    {matchedBracket.isExtraDay ? '⚡ Día extra (fallback)' : matchedBracket.label}
                  </span>
                  {!matchedBracket.isExtraDay && (
                    <span style={{
                      fontSize: '0.7rem', padding: '1px 7px',
                      background: 'var(--color-surface-strong)',
                      border: '1px solid var(--color-border)', borderRadius: 10,
                    }}>
                      {matchedBracket.minDays}{matchedBracket.maxDays ? `–${matchedBracket.maxDays}` : '+'} días
                    </span>
                  )}
                  {priceCell && (
                    <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {priceCell.pricingType}
                    </span>
                  )}
                </div>
              )}

              {/* Seguros / Extras sub-tabs */}
              <div>
                <div className={styles.innerTabs}>
                  {(['seguros', 'extras'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.innerTab} ${form.vehicleTabIn === t ? styles.innerTabActive : ''}`}
                      onClick={() => set('vehicleTabIn', t)}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {form.vehicleTabIn === 'seguros' && (
                  <SegurosTabContent
                    catalogInsurances={catalogInsurances}
                    formInsurances={formInsurances}
                    billedDays={parseInt(form.billedDays) || 1}
                    franchise={parseFloat(form.franchise) || 0}
                    onChange={setFormInsurances}
                    onFranchiseChange={(v) => set('franchise', v.toFixed(2))}
                  />
                )}

                {form.vehicleTabIn === 'extras' && (
                  <ExtrasTabContent
                    catalogExtras={catalogExtras}
                    formExtras={formExtras}
                    billedDays={parseInt(form.billedDays) || 1}
                    onChange={setFormExtras}
                    nightFeeConfig={nightFeeConfig}
                    nightFeeApplied={form.nightFeeApplied}
                    onNightFeeToggle={(v) => recalcTotal({ nightFeeApplied: v })}
                  />
                )}
              </div>

            </div>
          </div>
        </div>

        {/* ═══ Right column: Liquidación ═══ */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>Liquidación estimada</div>
          <div className={styles.liquidacion}>

            <div className={styles.liqRow}>
              <span className={styles.liqLabel}>Días facturados</span>
              <input
                className={styles.liqInput}
                type="number"
                min={1}
                value={form.billedDays}
                onChange={(e) => set('billedDays', e.target.value)}
                onBlur={() => handleNumBlur('billedDays')}
              />
            </div>

            <div className={styles.liqRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <span className={styles.liqLabel}>Tarifa aplicada</span>
              <select
                className={styles.liqSelect}
                value={form.tariffPlanId}
                onChange={(e) => set('tariffPlanId', e.target.value)}
              >
                <option value="">— Sin tarifa —</option>
                {matchingPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.liqRow}>
              <span className={styles.liqLabel}>Alquiler</span>
              <input
                className={styles.liqInput}
                type="number"
                min={0}
                step="0.01"
                value={form.basePrice}
                onChange={(e) => set('basePrice', e.target.value)}
                onBlur={() => handleNumBlur('basePrice')}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -2, marginBottom: 2 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void computeTariffPrice()}
                title="Recalcular precio según tarifa"
                style={{ marginTop: 2, whiteSpace: 'nowrap', fontSize: '0.78rem' }}
              >
                ↻ Tarifa
              </button>
            </div>
            {([
              { label: 'Descuento',   field: 'discount'       },
              { label: 'Seguro',      field: 'insuranceTotal' },
              { label: 'Franquicia',  field: 'franchise'      },
              { label: 'Extras',      field: 'extrasTotal'    },
              { label: 'Combustible', field: 'fuelCharge'     },
            ] as { label: string; field: keyof FormState }[]).map(({ label, field }) => (
              <div key={field} className={styles.liqRow}>
                <span className={styles.liqLabel}>{label}</span>
                <input
                  className={styles.liqInput}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form[field] as string}
                  onChange={(e) => set(field, e.target.value)}
                  onBlur={() => handleNumBlur(field)}
                />
              </div>
            ))}

            <div className={styles.liqTotal}>
              <div className={styles.liqTotalLabel}>Total estimado</div>
              <div className={styles.liqTotalValue}>{parseFloat(form.total).toFixed(2)} €</div>
            </div>

            <div className={styles.liqTotal} style={{ background: 'var(--color-primary)', borderTop: 'none' }}>
              <div className={styles.liqTotalLabel} style={{ color: 'rgba(255,255,255,0.7)' }}>Total a pagar</div>
              <div className={styles.liqTotalValue} style={{ color: '#fff', fontSize: '1.6rem' }}>
                {parseFloat(form.total).toFixed(2)}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ── Notes ── */}
      <div className={styles.notesCard}>
        <div className={styles.notesTabs}>
          <button type="button" className={`${styles.notesTab} ${styles.notesTabActive}`}>
            Observaciones
          </button>
        </div>
        <div className={styles.notesBody}>
          <textarea
            className={styles.notesTextarea}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Observaciones para incluir en el presupuesto…"
          />
        </div>
      </div>

      {/* ── Email feedback ── */}
      {emailFeedback && (
        <div
          className={emailFeedback.ok ? 'alert alert-success' : 'alert alert-danger'}
          style={{ marginTop: 8 }}
        >
          {emailFeedback.msg}
        </div>
      )}

      {/* ── Action bar ── */}
      <div className={styles.actionBar}>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Imprimir presupuesto
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleClear}>Limpiar campos</button>
        <div className={styles.actionBarRight}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!form.clientEmail || sendingEmail}
            title={form.clientEmail ? `Enviar a ${form.clientEmail}` : 'Introduce el email del cliente primero'}
            onClick={() => void handleSendEmail()}
          >
            {sendingEmail ? 'Enviando…' : 'Enviar por email'}
          </button>
        </div>
      </div>

    </div>
  );
}
