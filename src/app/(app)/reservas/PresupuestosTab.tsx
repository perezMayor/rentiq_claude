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
import styles from './presupuestos.module.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function calcBilledDays(startDate: string, endDate: string, startTime: string, endTime: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T${startTime || '09:00'}`);
  const end = new Date(`${endDate}T${endTime || '09:00'}`);
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function planCoversDate(plan: TariffPlan, startDate: string, endDate: string): boolean {
  // Plan is valid if it overlaps with [startDate, endDate]
  return plan.validFrom <= endDate && plan.validTo >= startDate;
}

function findBracket(brackets: TariffBracket[], days: number): TariffBracket | null {
  // Regular brackets sorted by minDays
  const regular = brackets
    .filter((b) => !b.isExtraDay)
    .sort((a, b) => a.minDays - b.minDays);

  for (const b of regular) {
    if (days >= b.minDays && (b.maxDays === null || days <= b.maxDays)) {
      return b;
    }
  }

  // Fallback: if days exceed all brackets, use isExtraDay bracket
  const extra = brackets.find((b) => b.isExtraDay);
  if (extra) return extra;

  return null;
}

function calcBasePrice(
  cell: TariffPrice | undefined,
  days: number,
  estimatedKm: number,
): number {
  if (!cell) return 0;
  const t: TariffCellType = cell.pricingType ?? 'DIA';
  if (t === 'LIBRE') return 0;
  if (t === 'FIJO') return cell.price;
  if (t === 'DIA') return cell.price * days;
  if (t === 'KM') return cell.price * estimatedKm;
  if (t === 'DIA_KM') {
    const kmOver = Math.max(0, estimatedKm - (cell.kmIncluidos ?? 0) * days);
    return cell.price * days + (cell.priceKm ?? 0) * kmOver;
  }
  return 0;
}

function calcItemPrice(item: VehicleExtra | VehicleInsurance, days: number, qty: number): number {
  const base = item.pricingMode === 'PER_DAY'
    ? item.unitPrice * Math.min(days, item.maxDays ?? days)
    : item.unitPrice;
  return base * qty;
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanDetail {
  plan: TariffPlan;
  brackets: TariffBracket[];
  prices: TariffPrice[];
}

interface ExtraLine {
  id: string;
  qty: number;
}

interface Form {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  categoryId: string;
  planId: string;
  insuranceId: string;
  fuelCharge: number;
  discount: number;
  estimatedKm: number;
  clientName: string;
  notes: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PresupuestosTab() {
  const [plans, setPlans] = useState<TariffPlan[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [extras, setExtras] = useState<VehicleExtra[]>([]);
  const [insurances, setInsurances] = useState<VehicleInsurance[]>([]);
  const [planDetail, setPlanDetail] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);

  const [form, setForm] = useState<Form>({
    startDate: todayStr(),
    endDate: tomorrowStr(),
    startTime: '09:00',
    endTime: '09:00',
    categoryId: '',
    planId: '',
    insuranceId: '',
    fuelCharge: 0,
    discount: 0,
    estimatedKm: 0,
    clientName: '',
    notes: '',
  });

  const [extraLines, setExtraLines] = useState<ExtraLine[]>([]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Load static data
  useEffect(() => {
    Promise.all([
      fetch('/api/tarifas').then((r) => r.json()),
      fetch('/api/vehiculos/categorias').then((r) => r.json()),
      fetch('/api/vehiculos/extras').then((r) => r.json()),
      fetch('/api/vehiculos/seguros').then((r) => r.json()),
    ]).then(([t, c, e, s]) => {
      setPlans((t.plans ?? []).filter((p: TariffPlan) => p.active));
      setCategories((c.categories ?? []).filter((x: VehicleCategory) => x.active));
      setExtras((e.extras ?? []).filter((x: VehicleExtra) => x.active));
      setInsurances((s.insurances ?? []).filter((x: VehicleInsurance) => x.active));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Auto-select plan when dates change
  useEffect(() => {
    if (!form.startDate || !form.endDate) return;
    const matching = plans.filter((p) => planCoversDate(p, form.startDate, form.endDate));
    if (matching.length === 1) {
      set('planId', matching[0].id);
    } else if (!matching.find((p) => p.id === form.planId)) {
      set('planId', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.endDate, plans]);

  // Load plan detail when planId changes
  useEffect(() => {
    if (!form.planId) { setPlanDetail(null); return; }
    setPlanLoading(true);
    fetch(`/api/tarifas/${form.planId}`)
      .then((r) => r.json())
      .then((d) => setPlanDetail({ plan: d.plan, brackets: d.brackets ?? [], prices: d.prices ?? [] }))
      .catch(() => setPlanDetail(null))
      .finally(() => setPlanLoading(false));
  }, [form.planId]);

  // ── Computed values ──

  const billedDays = useMemo(
    () => calcBilledDays(form.startDate, form.endDate, form.startTime, form.endTime),
    [form.startDate, form.endDate, form.startTime, form.endTime],
  );

  const matchedBracket = useMemo(() => {
    if (!planDetail || !billedDays) return null;
    return findBracket(planDetail.brackets, billedDays);
  }, [planDetail, billedDays]);

  const priceCell = useMemo(() => {
    if (!planDetail || !matchedBracket || !form.categoryId) return undefined;
    return planDetail.prices.find(
      (p) => p.bracketId === matchedBracket.id && p.categoryId === form.categoryId,
    );
  }, [planDetail, matchedBracket, form.categoryId]);

  const basePrice = useMemo(
    () => calcBasePrice(priceCell, billedDays, form.estimatedKm),
    [priceCell, billedDays, form.estimatedKm],
  );

  const selectedInsurance = useMemo(
    () => insurances.find((i) => i.id === form.insuranceId),
    [insurances, form.insuranceId],
  );

  const insuranceTotal = useMemo(
    () => (selectedInsurance ? calcItemPrice(selectedInsurance, billedDays, 1) : 0),
    [selectedInsurance, billedDays],
  );

  const extraItems = useMemo(
    () =>
      extraLines
        .map((line) => {
          const extra = extras.find((e) => e.id === line.id);
          if (!extra) return null;
          const total = calcItemPrice(extra, billedDays, line.qty);
          return { extra, qty: line.qty, total };
        })
        .filter(Boolean) as { extra: VehicleExtra; qty: number; total: number }[],
    [extraLines, extras, billedDays],
  );

  const extrasTotal = useMemo(
    () => extraItems.reduce((sum, x) => sum + x.total, 0),
    [extraItems],
  );

  const total = useMemo(
    () => Math.max(0, basePrice + insuranceTotal + extrasTotal + form.fuelCharge - form.discount),
    [basePrice, insuranceTotal, extrasTotal, form.fuelCharge, form.discount],
  );

  // ── Extra lines helpers ──

  function addExtraLine() {
    const available = extras.filter((e) => !extraLines.find((l) => l.id === e.id));
    if (!available.length) return;
    setExtraLines((prev) => [...prev, { id: available[0].id, qty: 1 }]);
  }

  function removeExtraLine(idx: number) {
    setExtraLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateExtraLine(idx: number, field: 'id' | 'qty', value: string | number) {
    setExtraLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  }

  const isValid = form.startDate && form.endDate && form.categoryId && billedDays > 0;
  const matchingPlans = plans.filter((p) => planCoversDate(p, form.startDate, form.endDate));

  if (loading) {
    return <div className={styles.loading}>Cargando datos…</div>;
  }

  return (
    <div className={styles.layout}>
      {/* ── Panel de configuración ── */}
      <div className={styles.configPanel}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Fechas y grupo</div>

          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.label}>Fecha inicio</label>
              <DatePicker className="form-input" value={form.startDate} onChange={(v) => set('startDate', v)} />
            </div>
            <div className={styles.fieldNarrow}>
              <label className={styles.label}>Hora</label>
              <input type="time" className="form-input" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.label}>Fecha fin</label>
              <DatePicker className="form-input" value={form.endDate} onChange={(v) => set('endDate', v)} />
            </div>
            <div className={styles.fieldNarrow}>
              <label className={styles.label}>Hora</label>
              <input type="time" className="form-input" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </div>
          </div>

          {billedDays > 0 && (
            <div className={styles.daysChip}>
              {billedDays} día{billedDays !== 1 ? 's' : ''} facturados
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Grupo de vehículo</label>
            <select className="form-select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Tarifa</div>

          {matchingPlans.length === 0 && form.startDate && form.endDate ? (
            <div className={styles.warn}>No hay tarifas activas para este período.</div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label}>Plan tarifario</label>
              <select
                className="form-select"
                value={form.planId}
                onChange={(e) => set('planId', e.target.value)}
              >
                <option value="">— Ninguno —</option>
                {matchingPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
          )}

          {planLoading && <div className={styles.infoText}>Cargando plan…</div>}

          {planDetail && billedDays > 0 && (
            <div className={styles.bracketInfo}>
              {matchedBracket ? (
                <>
                  <span className={styles.bracketLabel}>
                    {matchedBracket.isExtraDay ? '⚡ Día extra (fallback)' : matchedBracket.label}
                  </span>
                  {!matchedBracket.isExtraDay && (
                    <span className={styles.bracketDays}>
                      {matchedBracket.minDays}{matchedBracket.maxDays ? `–${matchedBracket.maxDays}` : '+'} días
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.warnSmall}>Sin tramo para {billedDays} días</span>
              )}
            </div>
          )}

          {priceCell && (
            <div className={styles.field}>
              <label className={styles.label}>Km estimados (para tarifas por km)</label>
              <input
                type="number"
                className="form-input"
                min="0"
                step="1"
                value={form.estimatedKm || ''}
                placeholder="0"
                onChange={(e) => set('estimatedKm', Number(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Seguro</div>
          <div className={styles.field}>
            <label className={styles.label}>Seguro incluido</label>
            <select className="form-select" value={form.insuranceId} onChange={(e) => set('insuranceId', e.target.value)}>
              <option value="">Sin seguro</option>
              {insurances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.pricingMode === 'PER_DAY' ? `${fmt(i.unitPrice)} €/día` : `${fmt(i.unitPrice)} € fijo`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <span className={styles.sectionTitle}>Extras</span>
            {extras.length > extraLines.length && (
              <button className={styles.addBtn} onClick={addExtraLine}>+ Añadir</button>
            )}
          </div>
          {extraLines.length === 0 ? (
            <div className={styles.infoText}>Sin extras.</div>
          ) : (
            <div className={styles.extrasList}>
              {extraLines.map((line, idx) => (
                <div key={idx} className={styles.extraRow}>
                  <select
                    className={`form-select ${styles.extraSelect}`}
                    value={line.id}
                    onChange={(e) => updateExtraLine(idx, 'id', e.target.value)}
                  >
                    {extras.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={`form-input ${styles.extraQty}`}
                    min="1"
                    max="99"
                    value={line.qty}
                    onChange={(e) => updateExtraLine(idx, 'qty', Number(e.target.value) || 1)}
                  />
                  <button className={styles.removeBtn} onClick={() => removeExtraLine(idx)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Ajustes</div>
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.label}>Combustible (€)</label>
              <input
                type="number"
                className="form-input"
                min="0"
                step="0.01"
                value={form.fuelCharge || ''}
                placeholder="0.00"
                onChange={(e) => set('fuelCharge', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Descuento (€)</label>
              <input
                type="number"
                className="form-input"
                min="0"
                step="0.01"
                value={form.discount || ''}
                placeholder="0.00"
                onChange={(e) => set('discount', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Datos del cliente</div>
          <div className={styles.field}>
            <label className={styles.label}>Nombre (opcional)</label>
            <input
              type="text"
              className="form-input"
              value={form.clientName}
              placeholder="Para incluir en el presupuesto"
              onChange={(e) => set('clientName', e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Notas</label>
            <textarea
              className="form-input"
              rows={2}
              value={form.notes}
              placeholder="Observaciones opcionales…"
              onChange={(e) => set('notes', e.target.value)}
              style={{ resize: 'vertical', minHeight: 56 }}
            />
          </div>
        </div>
      </div>

      {/* ── Panel de resultado ── */}
      <div className={styles.resultPanel}>
        {!isValid ? (
          <div className={styles.emptyResult}>
            <div className={styles.emptyIcon}>🧮</div>
            <div className={styles.emptyText}>
              Selecciona las fechas y el grupo de vehículo para calcular el presupuesto.
            </div>
          </div>
        ) : (
          <>
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <div className={styles.resultTitle}>Presupuesto</div>
                <div className={styles.resultMeta}>
                  {form.clientName && <span className={styles.clientName}>{form.clientName}</span>}
                  <span className={styles.resultDates}>
                    {fmtDate(form.startDate)} {form.startTime} — {fmtDate(form.endDate)} {form.endTime}
                  </span>
                </div>
              </div>

              <div className={styles.breakdown}>
                {/* Alquiler base */}
                <div className={styles.breakdownRow}>
                  <div className={styles.breakdownLabel}>
                    <span>Alquiler base</span>
                    <span className={styles.breakdownSub}>
                      {categories.find((c) => c.id === form.categoryId)?.name ?? '—'}
                      {matchedBracket && !matchedBracket.isExtraDay
                        ? ` · ${matchedBracket.label} (${billedDays}d)`
                        : ` · ${billedDays} día${billedDays !== 1 ? 's' : ''}`}
                      {priceCell && ` · ${priceCell.pricingType}`}
                    </span>
                  </div>
                  <span className={styles.breakdownAmount}>{fmt(basePrice)} €</span>
                </div>

                {/* Seguro */}
                {selectedInsurance && (
                  <div className={styles.breakdownRow}>
                    <div className={styles.breakdownLabel}>
                      <span>{selectedInsurance.name}</span>
                      <span className={styles.breakdownSub}>
                        {selectedInsurance.pricingMode === 'PER_DAY'
                          ? `${fmt(selectedInsurance.unitPrice)} €/día × ${Math.min(billedDays, selectedInsurance.maxDays ?? billedDays)} días`
                          : `${fmt(selectedInsurance.unitPrice)} € fijo`}
                      </span>
                    </div>
                    <span className={styles.breakdownAmount}>{fmt(insuranceTotal)} €</span>
                  </div>
                )}

                {/* Extras */}
                {extraItems.map(({ extra, qty, total }) => (
                  <div key={extra.id} className={styles.breakdownRow}>
                    <div className={styles.breakdownLabel}>
                      <span>{extra.name}{qty > 1 ? ` × ${qty}` : ''}</span>
                      <span className={styles.breakdownSub}>
                        {extra.pricingMode === 'PER_DAY'
                          ? `${fmt(extra.unitPrice)} €/día × ${Math.min(billedDays, extra.maxDays ?? billedDays)} días`
                          : `${fmt(extra.unitPrice)} € fijo`}
                        {qty > 1 ? ` × ${qty} ud.` : ''}
                      </span>
                    </div>
                    <span className={styles.breakdownAmount}>{fmt(total)} €</span>
                  </div>
                ))}

                {/* Combustible */}
                {form.fuelCharge > 0 && (
                  <div className={styles.breakdownRow}>
                    <div className={styles.breakdownLabel}>
                      <span>Combustible</span>
                    </div>
                    <span className={styles.breakdownAmount}>{fmt(form.fuelCharge)} €</span>
                  </div>
                )}

                {/* Descuento */}
                {form.discount > 0 && (
                  <div className={`${styles.breakdownRow} ${styles.breakdownDiscount}`}>
                    <div className={styles.breakdownLabel}>
                      <span>Descuento</span>
                    </div>
                    <span className={styles.breakdownAmount}>−{fmt(form.discount)} €</span>
                  </div>
                )}

                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Total estimado</span>
                  <span className={styles.totalAmount}>{fmt(total)} €</span>
                </div>
              </div>

              {form.notes && (
                <div className={styles.resultNotes}>
                  <span className={styles.notesLabel}>Notas:</span> {form.notes}
                </div>
              )}

              <div className={styles.resultDisclaimer}>
                Presupuesto orientativo, no vinculante. Sujeto a disponibilidad y condiciones vigentes.
              </div>
            </div>

            <div className={styles.resultActions}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => window.print()}
              >
                🖨 Imprimir
              </button>
              <button
                className="btn btn-ghost btn-sm"
                title="Próximamente"
                onClick={() => alert('Envío por email: próximamente')}
              >
                ✉ Enviar por email
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
