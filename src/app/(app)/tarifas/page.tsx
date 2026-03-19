'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  TariffPlan,
  TariffBracket,
  TariffPrice,
  VehicleCategory,
  PricingMode,
} from '@/src/lib/types';
import styles from './tarifas.module.css';

const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  PRECIO_A: 'Precio A',
  PRECIO_B: 'Precio B',
  PRECIO_C: 'Precio C',
};

type PlanDetail = {
  plan: TariffPlan;
  brackets: TariffBracket[];
  prices: TariffPrice[];
  categories: VehicleCategory[];
};

type PriceMap = Record<string, number>; // `${bracketId}:${categoryId}` → price

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function TarifasPage() {
  const [plans, setPlans] = useState<TariffPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  // Selected plan detail
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Price editing
  const [priceMap, setPriceMap] = useState<PriceMap>({});
  const [priceDirty, setPriceDirty] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceError, setPriceError] = useState('');

  // Plan modal
  const [planModal, setPlanModal] = useState<'create' | 'edit' | null>(null);
  const [planEdit, setPlanEdit] = useState<Partial<TariffPlan>>({});
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState('');

  // Bracket modal
  const [bracketModal, setBracketModal] = useState<'create' | 'edit' | null>(null);
  const [bracketEdit, setBracketEdit] = useState<Partial<TariffBracket>>({});
  const [bracketSaving, setBracketSaving] = useState(false);
  const [bracketError, setBracketError] = useState('');

  const canWrite = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setUserRole(d.role ?? '')).catch(() => {});
  }, []);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tarifas');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setPlans((await res.json()).plans ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const loadDetail = useCallback(async (planId: string) => {
    setDetailLoading(true);
    setPriceError('');
    try {
      const res = await fetch(`/api/tarifas/${planId}`);
      if (!res.ok) throw new Error('Error al cargar plan');
      const data: PlanDetail = await res.json();
      setDetail(data);

      // Build price map
      const map: PriceMap = {};
      for (const p of data.prices) {
        map[`${p.bracketId}:${p.categoryId}`] = p.price;
      }
      setPriceMap(map);
      setPriceDirty(false);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlanId) loadDetail(selectedPlanId);
  }, [selectedPlanId, loadDetail]);

  function handlePriceChange(bracketId: string, categoryId: string, value: string) {
    const key = `${bracketId}:${categoryId}`;
    const price = parseFloat(value);
    setPriceMap((m) => ({ ...m, [key]: isNaN(price) ? 0 : price }));
    setPriceDirty(true);
  }

  async function savePrices() {
    if (!detail) return;
    setPriceSaving(true);
    setPriceError('');
    try {
      const prices = Object.entries(priceMap).map(([key, price]) => {
        const [bracketId, categoryId] = key.split(':');
        return { bracketId, categoryId, price };
      });
      const res = await fetch(`/api/tarifas/${detail.plan.id}/precios`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setPriceDirty(false);
    } catch (e) {
      setPriceError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setPriceSaving(false);
    }
  }

  // Plan CRUD
  function openCreatePlan() {
    setPlanEdit({ pricingMode: 'PRECIO_A', active: true });
    setPlanError('');
    setPlanModal('create');
  }

  function openEditPlan(plan: TariffPlan) {
    setPlanEdit({ ...plan });
    setPlanError('');
    setPlanModal('edit');
  }

  async function savePlan() {
    setPlanSaving(true);
    setPlanError('');
    try {
      const isEdit = planModal === 'edit';
      const url = isEdit ? `/api/tarifas/${planEdit.id}` : '/api/tarifas';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planEdit.name,
          pricingMode: planEdit.pricingMode,
          validFrom: planEdit.validFrom,
          validTo: planEdit.validTo,
          active: planEdit.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setPlanModal(null);
      await loadPlans();
      if (!isEdit && data.plan?.id) {
        setSelectedPlanId(data.plan.id);
      } else if (isEdit && detail) {
        setDetail((d) => d ? { ...d, plan: data.plan } : null);
      }
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setPlanSaving(false);
    }
  }

  async function deletePlan(planId: string) {
    if (!confirm('¿Eliminar este plan tarifario? Se eliminarán todos sus tramos y precios.')) return;
    try {
      const res = await fetch(`/api/tarifas/${planId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Error');
        return;
      }
      if (selectedPlanId === planId) {
        setSelectedPlanId(null);
        setDetail(null);
      }
      await loadPlans();
    } catch {
      alert('Error de red');
    }
  }

  // Bracket CRUD
  function openCreateBracket() {
    setBracketEdit({});
    setBracketError('');
    setBracketModal('create');
  }

  async function saveBracket() {
    if (!detail) return;
    setBracketSaving(true);
    setBracketError('');
    try {
      const isEdit = bracketModal === 'edit';
      const url = isEdit
        ? `/api/tarifas/${detail.plan.id}/tramos/${bracketEdit.id}`
        : `/api/tarifas/${detail.plan.id}/tramos`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: bracketEdit.label,
          minDays: Number(bracketEdit.minDays),
          maxDays: bracketEdit.maxDays ? Number(bracketEdit.maxDays) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setBracketModal(null);
      await loadDetail(detail.plan.id);
    } catch (e) {
      setBracketError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBracketSaving(false);
    }
  }

  async function deleteBracket(bracketId: string) {
    if (!detail) return;
    if (!confirm('¿Eliminar este tramo?')) return;
    try {
      const res = await fetch(`/api/tarifas/${detail.plan.id}/tramos/${bracketId}`, { method: 'DELETE' });
      if (!res.ok) { alert('Error al eliminar tramo'); return; }
      await loadDetail(detail.plan.id);
    } catch {
      alert('Error de red');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tarifas</h1>
          <p className="page-subtitle">{plans.length} plan{plans.length !== 1 ? 'es' : ''} tarifario{plans.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={openCreatePlan}>+ Nuevo plan</button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className={styles.loadingRow}>Cargando tarifas…</div>
      ) : (
        <div className={styles.layout}>
          {/* Plan list */}
          <div>
            <div className={styles.planList}>
              {plans.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 16px' }}>
                  <div className="empty-state__text">No hay planes tarifarios. Crea el primero.</div>
                </div>
              ) : (
                plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`${styles.planCard} ${selectedPlanId === plan.id ? styles.planCardActive : ''}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div className={styles.planName}>{plan.name}</div>
                    <div className={styles.planMeta}>
                      {PRICING_MODE_LABELS[plan.pricingMode]} ·{' '}
                      {formatDate(plan.validFrom)} – {formatDate(plan.validTo)}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span className={`badge ${plan.active ? 'badge-cerrado' : 'badge-cancelada'}`}>
                        {plan.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Plan detail */}
          <div>
            {!selectedPlanId ? (
              <div className="empty-state">
                <div className="empty-state__icon">💲</div>
                <div className="empty-state__text">Selecciona un plan para ver su configuración.</div>
              </div>
            ) : detailLoading ? (
              <div className={styles.loadingRow}>Cargando plan…</div>
            ) : detail ? (
              <div className={styles.detailCard}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitle}>{detail.plan.name}</div>
                  {canWrite && (
                    <div className={styles.detailActions}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditPlan(detail.plan)}>
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => deletePlan(detail.plan.id)}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.detailBody}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>
                    {PRICING_MODE_LABELS[detail.plan.pricingMode]} ·{' '}
                    Vigente: {formatDate(detail.plan.validFrom)} – {formatDate(detail.plan.validTo)}
                  </div>

                  {detail.brackets.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px 0' }}>
                      <div className="empty-state__text">Este plan no tiene tramos. Añade el primero.</div>
                    </div>
                  ) : (
                    <div className={styles.priceGrid}>
                      <table className={styles.priceTable}>
                        <thead>
                          <tr>
                            <th>Tramo</th>
                            {detail.categories.map((cat) => (
                              <th key={cat.id}>{cat.name}</th>
                            ))}
                            {canWrite && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.brackets.map((bracket) => (
                            <tr key={bracket.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{bracket.label}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {bracket.minDays}{bracket.maxDays ? `–${bracket.maxDays}` : '+'} días
                                </div>
                              </td>
                              {detail.categories.map((cat) => {
                                const key = `${bracket.id}:${cat.id}`;
                                const val = priceMap[key] ?? 0;
                                return (
                                  <td key={cat.id}>
                                    {canWrite ? (
                                      <input
                                        type="number"
                                        className={styles.priceInput}
                                        value={val === 0 ? '' : val}
                                        min="0"
                                        step="0.5"
                                        placeholder="0"
                                        onChange={(e) => handlePriceChange(bracket.id, cat.id, e.target.value)}
                                      />
                                    ) : (
                                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {val > 0 ? `${val.toFixed(2)} €` : '—'}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                              {canWrite && (
                                <td>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ fontSize: '0.75rem' }}
                                      onClick={() => {
                                        setBracketEdit({ ...bracket });
                                        setBracketError('');
                                        setBracketModal('edit');
                                      }}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}
                                      onClick={() => deleteBracket(bracket.id)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {priceError && <div className="alert alert-danger" style={{ marginTop: 12 }}>{priceError}</div>}

                  {canWrite && (
                    <div className={styles.bracketActions}>
                      <button className="btn btn-ghost btn-sm" onClick={openCreateBracket}>
                        + Añadir tramo
                      </button>
                      {priceDirty && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={savePrices}
                          disabled={priceSaving}
                        >
                          {priceSaving ? 'Guardando…' : 'Guardar precios'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Plan modal */}
      {planModal && (
        <div className="modal-overlay" onClick={() => setPlanModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">
                {planModal === 'create' ? 'Nuevo plan tarifario' : 'Editar plan'}
              </span>
              <button className="modal__close" onClick={() => setPlanModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-group col-span-2">
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={planEdit.name ?? ''}
                    onChange={(e) => setPlanEdit((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Tarifa Estándar 2026"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Modo de precio *</label>
                  <select
                    className="form-select"
                    value={planEdit.pricingMode ?? 'PRECIO_A'}
                    onChange={(e) => setPlanEdit((p) => ({ ...p, pricingMode: e.target.value as PricingMode }))}
                  >
                    <option value="PRECIO_A">Precio A</option>
                    <option value="PRECIO_B">Precio B</option>
                    <option value="PRECIO_C">Precio C</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={planEdit.active ? 'true' : 'false'}
                    onChange={(e) => setPlanEdit((p) => ({ ...p, active: e.target.value === 'true' }))}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Válido desde *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={planEdit.validFrom ?? ''}
                    onChange={(e) => setPlanEdit((p) => ({ ...p, validFrom: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Válido hasta *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={planEdit.validTo ?? ''}
                    onChange={(e) => setPlanEdit((p) => ({ ...p, validTo: e.target.value }))}
                  />
                </div>
              </div>
              {planError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{planError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setPlanModal(null)} disabled={planSaving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={savePlan} disabled={planSaving}>
                {planSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bracket modal */}
      {bracketModal && (
        <div className="modal-overlay" onClick={() => setBracketModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal__header">
              <span className="modal__title">
                {bracketModal === 'create' ? 'Añadir tramo' : 'Editar tramo'}
              </span>
              <button className="modal__close" onClick={() => setBracketModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-group col-span-2">
                  <label className="form-label">Etiqueta *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bracketEdit.label ?? ''}
                    onChange={(e) => setBracketEdit((b) => ({ ...b, label: e.target.value }))}
                    placeholder="1-3 días"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Días mínimo *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={bracketEdit.minDays ?? ''}
                    onChange={(e) => setBracketEdit((b) => ({ ...b, minDays: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Días máximo (vacío = sin límite)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={bracketEdit.maxDays ?? ''}
                    onChange={(e) => setBracketEdit((b) => ({
                      ...b,
                      maxDays: e.target.value ? Number(e.target.value) : null
                    }))}
                    placeholder="Sin límite"
                  />
                </div>
              </div>
              {bracketError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{bracketError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setBracketModal(null)} disabled={bracketSaving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveBracket} disabled={bracketSaving}>
                {bracketSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
