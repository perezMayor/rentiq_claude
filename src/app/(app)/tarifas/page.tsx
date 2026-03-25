'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TariffPlan, TariffBracket, TariffPrice, TariffCellType, VehicleCategory } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import styles from './tarifas.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type CellKey = `${string}:${string}`; // bracketId:categoryId

interface CellValue {
  pricingType: TariffCellType;
  price: number;
  priceKm?: number;
  kmIncluidos?: number;
}

type CellMap = Record<CellKey, CellValue>;

type PlanDetail = {
  plan: TariffPlan;
  brackets: TariffBracket[];
  prices: TariffPrice[];
  categories: VehicleCategory[];
};

const CELL_TYPE_LABELS: Record<TariffCellType, string> = {
  FIJO:   'Precio fijo',
  DIA:    'Por día',
  KM:     'Por km',
  DIA_KM: 'Día + km',
  LIBRE:  'Gratuito',
};

const CELL_TYPE_SHORT: Record<TariffCellType, string> = {
  FIJO:   'Fijo',
  DIA:    '€/día',
  KM:     '€/km',
  DIA_KM: 'Día+km',
  LIBRE:  'Gratis',
};

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function cellKey(bracketId: string, categoryId: string): CellKey {
  return `${bracketId}:${categoryId}`;
}

function defaultCell(): CellValue {
  return { pricingType: 'DIA', price: 0 };
}

// ─── Cell component ───────────────────────────────────────────────────────────

function TariffCell({
  value,
  onChange,
  readOnly,
}: {
  value: CellValue;
  onChange: (v: CellValue) => void;
  readOnly: boolean;
}) {
  const t = value.pricingType;

  if (readOnly) {
    return (
      <div className={styles.cellReadOnly}>
        <div className={styles.cellTypeTag}>{CELL_TYPE_SHORT[t]}</div>
        {t !== 'LIBRE' && (
          <div className={styles.cellPriceDisplay}>
            {t === 'DIA_KM' ? (
              <>
                <span>{value.price.toFixed(2)} €/día</span>
                <span className={styles.cellSub}>{(value.priceKm ?? 0).toFixed(3)} €/km · {value.kmIncluidos ?? 0} km/d incl.</span>
              </>
            ) : t === 'KM' ? (
              <span>{value.price.toFixed(3)} €/km</span>
            ) : t === 'FIJO' ? (
              <span>{value.price.toFixed(2)} € total</span>
            ) : (
              <span>{value.price.toFixed(2)} €/día</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.cell}>
      <select
        className={styles.cellTypeSelect}
        value={t}
        onChange={(e) => onChange({ ...value, pricingType: e.target.value as TariffCellType })}
      >
        {(Object.keys(CELL_TYPE_LABELS) as TariffCellType[]).map((k) => (
          <option key={k} value={k}>{CELL_TYPE_LABELS[k]}</option>
        ))}
      </select>

      {t !== 'LIBRE' && (
        <div className={styles.cellInputs}>
          <div className={styles.cellInputRow}>
            <input
              type="number"
              className={styles.cellInput}
              value={value.price || ''}
              min="0"
              step="0.01"
              placeholder="0.00"
              onChange={(e) => onChange({ ...value, price: parseFloat(e.target.value) || 0 })}
            />
            <span className={styles.cellUnit}>
              {t === 'KM' ? '€/km' : t === 'FIJO' ? '€' : '€/día'}
            </span>
          </div>

          {t === 'DIA_KM' && (
            <>
              <div className={styles.cellInputRow}>
                <input
                  type="number"
                  className={styles.cellInput}
                  value={value.priceKm || ''}
                  min="0"
                  step="0.001"
                  placeholder="0.000"
                  onChange={(e) => onChange({ ...value, priceKm: parseFloat(e.target.value) || 0 })}
                />
                <span className={styles.cellUnit}>€/km</span>
              </div>
              <div className={styles.cellInputRow}>
                <input
                  type="number"
                  className={styles.cellInput}
                  value={value.kmIncluidos || ''}
                  min="0"
                  step="1"
                  placeholder="km/día"
                  onChange={(e) => onChange({ ...value, kmIncluidos: parseInt(e.target.value) || 0 })}
                />
                <span className={styles.cellUnit}>km/d</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Plan form modal ──────────────────────────────────────────────────────────

function PlanModal({
  mode,
  initial,
  onSave,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial: Partial<TariffPlan>;
  onSave: (data: Partial<TariffPlan>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<TariffPlan>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!form.name?.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.code?.trim()) { setError('El código es obligatorio'); return; }
    if (!form.validFrom || !form.validTo) { setError('Las fechas son obligatorias'); return; }
    if (form.validFrom >= form.validTo) { setError('La fecha de inicio debe ser anterior a la de fin'); return; }
    setSaving(true); setError('');
    try { await onSave(form); } catch (e) { setError(e instanceof Error ? e.message : 'Error'); setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title">{mode === 'create' ? 'Nueva tarifa' : 'Editar tarifa'}</span>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / 3' }}>
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tarifa Verano 2026" />
            </div>
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input className="form-input" value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VER-26" maxLength={10} style={{ fontFamily: 'monospace' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-select" value={form.active ? 'true' : 'false'} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === 'true' }))}>
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Válida desde *</label>
              <DatePicker className="form-input" value={form.validFrom ?? ''} onChange={(v) => setForm((f) => ({ ...f, validFrom: v }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Válida hasta *</label>
              <DatePicker className="form-input" value={form.validTo ?? ''} onChange={(v) => setForm((f) => ({ ...f, validTo: v }))} />
            </div>
          </div>
          {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal__footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Bracket modal ────────────────────────────────────────────────────────────

function BracketModal({
  mode,
  initial,
  onSave,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial: Partial<TariffBracket>;
  onSave: (data: Partial<TariffBracket>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<{ label: string; days: string }>({
    label: initial.label ?? '',
    days: initial.minDays ? String(initial.minDays) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!form.label.trim()) { setError('La etiqueta es obligatoria'); return; }
    if (!form.days || Number(form.days) < 1) { setError('El número de días debe ser ≥ 1'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ ...initial, label: form.label, minDays: Number(form.days), maxDays: null, isExtraDay: false });
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title">
            {mode === 'create' ? 'Añadir período' : 'Editar período'}
          </span>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / 3' }}>
              <label className="form-label">Etiqueta *</label>
              <input
                className="form-input"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ej: Fin de semana, Semanal, Mensual…"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Número de días *</label>
              <input
                type="number"
                className="form-input"
                min="1"
                value={form.days}
                onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
              />
            </div>
          </div>
          {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal__footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TarifasPage() {
  const [plans, setPlans] = useState<TariffPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [cellMap, setCellMap] = useState<CellMap>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [planModal, setPlanModal] = useState<'create' | 'edit' | null>(null);
  const [bracketModal, setBracketModal] = useState<'create' | 'edit' | null>(null);
  const [bracketEdit, setBracketEdit] = useState<Partial<TariffBracket>>({});

  const canWrite = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setUserRole(d.role ?? '')).catch(() => {});
  }, []);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tarifas');
      if (res.ok) setPlans((await res.json()).plans ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const loadDetail = useCallback(async (planId: string) => {
    setDetailLoading(true); setSaveError('');
    try {
      const res = await fetch(`/api/tarifas/${planId}`);
      if (!res.ok) return;
      const data: PlanDetail = await res.json();
      setDetail(data);
      const map: CellMap = {};
      for (const p of data.prices) {
        map[cellKey(p.bracketId, p.categoryId)] = {
          pricingType: p.pricingType ?? 'DIA',
          price: p.price,
          priceKm: p.priceKm,
          kmIncluidos: p.kmIncluidos,
        };
      }
      setCellMap(map);
      setDirty(false);
    } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function updateCell(bracketId: string, categoryId: string, value: CellValue) {
    setCellMap((m) => ({ ...m, [cellKey(bracketId, categoryId)]: value }));
    setDirty(true);
  }

  async function saveAll() {
    if (!detail) return;
    setSaving(true); setSaveError('');
    try {
      const prices = Object.entries(cellMap).map(([key, v]) => {
        const [bracketId, categoryId] = key.split(':');
        return { bracketId, categoryId, ...v };
      });
      const res = await fetch(`/api/tarifas/${detail.plan.id}/precios`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setDirty(false);
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  // Plan CRUD
  async function savePlan(data: Partial<TariffPlan>) {
    const isEdit = planModal === 'edit';
    const url = isEdit ? `/api/tarifas/${data.id}` : '/api/tarifas';
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, code: data.code, validFrom: data.validFrom, validTo: data.validTo, active: data.active }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error');
    setPlanModal(null);
    await loadPlans();
    if (!isEdit && json.plan?.id) setSelectedId(json.plan.id);
    else if (isEdit) setDetail((d) => d ? { ...d, plan: json.plan } : null);
  }

  async function deletePlan(planId: string) {
    if (!confirm('¿Eliminar esta tarifa? Se eliminarán todos sus períodos y precios.')) return;
    const res = await fetch(`/api/tarifas/${planId}`, { method: 'DELETE' });
    if (!res.ok) { alert((await res.json()).error ?? 'Error'); return; }
    if (selectedId === planId) { setSelectedId(null); setDetail(null); }
    await loadPlans();
  }

  // Bracket CRUD
  async function saveBracket(data: Partial<TariffBracket>) {
    if (!detail) return;
    const isEdit = bracketModal === 'edit';
    const url = isEdit
      ? `/api/tarifas/${detail.plan.id}/tramos/${data.id}`
      : `/api/tarifas/${detail.plan.id}/tramos`;
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: data.label,
        isExtraDay: false,
        minDays: Number(data.minDays),
        maxDays: null,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error');
    setBracketModal(null);
    await loadDetail(detail.plan.id);
  }

  async function deleteBracket(bracketId: string) {
    if (!detail) return;
    if (!confirm('¿Eliminar este período? Se perderán sus precios.')) return;
    const res = await fetch(`/api/tarifas/${detail.plan.id}/tramos/${bracketId}`, { method: 'DELETE' });
    if (!res.ok) { alert('Error al eliminar'); return; }
    await loadDetail(detail.plan.id);
  }

  // ── Render ──

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tarifas</h1>
          <p className="page-subtitle">{plans.length} tarifa{plans.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setPlanModal('create')}>+ Nueva tarifa</button>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingRow}>Cargando tarifas…</div>
      ) : (
        <div className={styles.layout}>
          {/* ── Lista de planes ── */}
          <div className={styles.planList}>
            {plans.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <div className="empty-state__text">No hay tarifas. Crea la primera.</div>
              </div>
            ) : plans.map((plan) => (
              <div
                key={plan.id}
                className={`${styles.planCard} ${selectedId === plan.id ? styles.planCardActive : ''}`}
                onClick={() => setSelectedId(plan.id)}
              >
                <div className={styles.planCardHeader}>
                  <span className={styles.planName}>{plan.name}</span>
                  <span className={styles.planCode}>{plan.code}</span>
                </div>
                <div className={styles.planMeta}>
                  {formatDate(plan.validFrom)} — {formatDate(plan.validTo)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${plan.active ? 'badge-cerrado' : 'badge-cancelada'}`}>
                    {plan.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ── Detalle / Tabla ── */}
          <div className={styles.detailArea}>
            {!selectedId ? (
              <div className="empty-state">
                <div className="empty-state__icon">📋</div>
                <div className="empty-state__text">Selecciona una tarifa para ver su tabla de precios.</div>
              </div>
            ) : detailLoading ? (
              <div className={styles.loadingRow}>Cargando…</div>
            ) : detail ? (
              <div className={styles.detailCard}>
                {/* Header del plan */}
                <div className={styles.detailHeader}>
                  <div className={styles.detailMeta}>
                    <span className={styles.detailName}>{detail.plan.name}</span>
                    <span className={styles.detailCode}>{detail.plan.code}</span>
                    <span className={styles.detailDates}>
                      {formatDate(detail.plan.validFrom)} — {formatDate(detail.plan.validTo)}
                    </span>
                    <span className={`badge ${detail.plan.active ? 'badge-cerrado' : 'badge-cancelada'}`}>
                      {detail.plan.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  {canWrite && (
                    <div className={styles.detailHeaderActions}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setPlanModal('edit')}>Editar</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => deletePlan(detail.plan.id)}>Eliminar</button>
                    </div>
                  )}
                </div>

                {/* Tabla estilo Excel */}
                {(() => {
                  const allBrackets = [...detail.brackets].sort((a, b) => a.minDays - b.minDays);
                  const totalCols = allBrackets.length + (canWrite ? 2 : 1);

                  return (
                    <div className={styles.tableWrap}>
                      <table className={styles.priceTable}>
                        <thead>
                          <tr>
                            <th className={`${styles.th} ${styles.thGroup}`}>Grupo / Período</th>
                            {allBrackets.map((b) => (
                              <th key={b.id} className={styles.th}>
                                <div className={styles.thContent}>
                                  <span className={styles.thLabel}>{b.label}</span>
                                  <span className={styles.thDays}>
                                    {b.minDays} {b.minDays === 1 ? 'día' : 'días'}
                                  </span>
                                  {canWrite && (
                                    <div className={styles.thActions}>
                                      <button className={styles.thBtn} title="Editar" onClick={() => { setBracketEdit({ ...b }); setBracketModal('edit'); }}>✏</button>
                                      <button className={styles.thBtn} title="Eliminar" onClick={() => deleteBracket(b.id)}>✕</button>
                                    </div>
                                  )}
                                </div>
                              </th>
                            ))}
                            {canWrite && (
                              <th className={`${styles.th} ${styles.thAdd}`}>
                                <button className={styles.addColBtn} onClick={() => { setBracketEdit({}); setBracketModal('create'); }}>+ Período</button>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.categories.length === 0 ? (
                            <tr>
                              <td colSpan={totalCols} className={styles.emptyRow}>
                                No hay grupos de vehículos definidos.
                              </td>
                            </tr>
                          ) : detail.categories.map((cat) => (
                            <tr key={cat.id}>
                              <td className={`${styles.td} ${styles.tdGroup}`}>
                                <span className={styles.groupName}>{cat.name}</span>
                              </td>
                              {allBrackets.map((b) => {
                                const key = cellKey(b.id, cat.id);
                                const val = cellMap[key] ?? defaultCell();
                                return (
                                  <td key={b.id} className={styles.td}>
                                    <TariffCell value={val} onChange={(v) => updateCell(b.id, cat.id, v)} readOnly={!canWrite} />
                                  </td>
                                );
                              })}
                              {canWrite && <td className={styles.td} />}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Barra inferior */}
                {canWrite && (
                  <div className={styles.tableFooter}>
                    {saveError && <span className={styles.saveError}>{saveError}</span>}
                    <button
                      className={`btn btn-primary ${!dirty ? styles.btnDisabled : ''}`}
                      onClick={saveAll}
                      disabled={!dirty || saving}
                    >
                      {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios pendientes'}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modales */}
      {planModal && (
        <PlanModal
          mode={planModal}
          initial={planModal === 'edit' && detail ? { ...detail.plan } : { active: true }}
          onSave={savePlan}
          onClose={() => setPlanModal(null)}
        />
      )}
      {bracketModal && (
        <BracketModal
          mode={bracketModal}
          initial={bracketEdit}
          onSave={saveBracket}
          onClose={() => setBracketModal(null)}
        />
      )}
    </div>
  );
}
