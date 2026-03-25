'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailyExpense, ExpenseCategory, FleetVehicle } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import styles from './gastos.module.css';
import PrintButton from '@/src/components/PrintButton';

const CATEGORIES: ExpenseCategory[] = ['GASOLINA', 'PEAJE', 'COMIDA', 'PARKING', 'LAVADO', 'OTRO'];
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  GASOLINA: 'Gasolina',
  PEAJE: 'Peaje',
  COMIDA: 'Comida',
  PARKING: 'Parking',
  LAVADO: 'Lavado',
  OTRO: 'Otro',
};

type CategoryAmounts = Record<ExpenseCategory, string>;
function emptyAmounts(): CategoryAmounts {
  return { GASOLINA: '', PEAJE: '', COMIDA: '', PARKING: '', LAVADO: '', OTRO: '' };
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ─── Registrar Tab ────────────────────────────────────────────────────────────

function RegistrarTab({ vehicles, canWrite }: { vehicles: FleetVehicle[]; canWrite: boolean }) {
  const [date, setDate] = useState(todayStr);
  const [activePlates, setActivePlates] = useState<string[]>([]);
  const [loadingPlates, setLoadingPlates] = useState(false);
  const [platesLoaded, setPlatesLoaded] = useState(false);
  const [amounts, setAmounts] = useState<CategoryAmounts>(emptyAmounts);
  const [worker, setWorker] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [manualPlate, setManualPlate] = useState('');

  // When date changes, reset plates
  useEffect(() => {
    setPlatesLoaded(false);
    setActivePlates([]);
  }, [date]);

  async function loadActivePlates() {
    if (!date) return;
    setLoadingPlates(true);
    setError('');
    try {
      const res = await fetch(`/api/contratos?activeOn=${date}&status=ABIERTO`);
      if (!res.ok) throw new Error('Error al cargar contratos');
      const data = await res.json();
      const plates = [
        ...new Set(
          (data.contracts ?? [])
            .filter((c: { plate?: string }) => c.plate)
            .map((c: { plate: string }) => c.plate as string)
        ),
      ] as string[];
      setActivePlates(plates);
      setPlatesLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoadingPlates(false);
    }
  }

  function removePlate(plate: string) {
    setActivePlates((prev) => prev.filter((p) => p !== plate));
  }

  function addManualPlate() {
    const p = manualPlate.trim().toUpperCase();
    if (!p || activePlates.includes(p)) { setManualPlate(''); return; }
    setActivePlates((prev) => [...prev, p]);
    setManualPlate('');
  }

  const total = CATEGORIES.reduce((s, cat) => s + (parseFloat(amounts[cat]) || 0), 0);
  const perVehicle = activePlates.length > 0 ? total / activePlates.length : 0;
  const perVehicleByCat = (cat: ExpenseCategory) => {
    const catTotal = parseFloat(amounts[cat]) || 0;
    return activePlates.length > 0 ? catTotal / activePlates.length : 0;
  };

  async function handleSubmit() {
    setError('');
    if (!activePlates.length) { setError('No hay vehículos seleccionados para ese día.'); return; }
    if (total <= 0) { setError('Introduce al menos un importe mayor que 0.'); return; }

    setSaving(true);
    try {
      const items: { plate: string; category: ExpenseCategory; amount: number; worker?: string; notes?: string }[] = [];
      for (const plate of activePlates) {
        for (const cat of CATEGORIES) {
          const catTotal = parseFloat(amounts[cat]) || 0;
          if (catTotal <= 0) continue;
          items.push({
            plate,
            category: cat,
            amount: Math.round((catTotal / activePlates.length) * 100) / 100,
            worker: worker.trim() || undefined,
            notes: notes.trim() || undefined,
          });
        }
      }

      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, items }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Error al guardar');
      }
      setSaved(true);
      setAmounts(emptyAmounts());
      setWorker('');
      setNotes('');
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  const allVehiclePlates = vehicles.map((v) => v.plate).filter((p) => !activePlates.includes(p));

  if (!canWrite) {
    return (
      <div className="empty-state">
        <div className="empty-state__text">Sin permisos para registrar gastos.</div>
      </div>
    );
  }

  return (
    <div>
      {error  && <div className="alert alert-danger">{error}</div>}
      {saved  && <div className="alert alert-success">Gastos registrados y repartidos entre {activePlates.length} vehículo{activePlates.length !== 1 ? 's' : ''}.</div>}

      {/* ── Fecha + cargar ── */}
      <div className={styles.regCard}>
        <div className={styles.regCardHeader}>1. Fecha del día</div>
        <div className={styles.regCardBody}>
          <div className={styles.dateRow}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Fecha</label>
              <DatePicker
                className="form-input"
                value={date}
                onChange={(v) => setDate(v)}
                style={{ width: 'auto' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={loadActivePlates}
              disabled={loadingPlates || !date}
            >
              {loadingPlates ? 'Cargando…' : 'Cargar vehículos activos'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Vehículos ── */}
      <div className={styles.regCard}>
        <div className={styles.regCardHeader}>2. Vehículos activos ese día</div>
        <div className={styles.regCardBody}>
          {!platesLoaded && !loadingPlates && (
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Selecciona una fecha y pulsa <em>Cargar vehículos activos</em> para detectar los contratos abiertos.
            </p>
          )}

          {platesLoaded && (
            <div className={styles.platesSection}>
              <div className={styles.platesLabel}>
                {activePlates.length > 0
                  ? `${activePlates.length} vehículo${activePlates.length !== 1 ? 's' : ''} — los gastos se repartirán entre todos`
                  : 'No se encontraron contratos abiertos con matrícula asignada para esa fecha'}
              </div>
              <div className={styles.platesRow}>
                {activePlates.length === 0 && (
                  <span className={styles.noPlates}>Sin vehículos activos</span>
                )}
                {activePlates.map((plate) => (
                  <span key={plate} className={styles.plateBadge}>
                    {plate}
                    <button
                      type="button"
                      className={styles.plateBadgeRemove}
                      onClick={() => removePlate(plate)}
                      title="Quitar"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Manual plate addition */}
          <div className={styles.platesManual}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Añadir manualmente:</span>
            <select
              className="form-select"
              value={manualPlate}
              onChange={(e) => setManualPlate(e.target.value)}
              style={{ width: 'auto', minWidth: 140 }}
            >
              <option value="">— Matrícula —</option>
              {allVehiclePlates.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={addManualPlate}
              disabled={!manualPlate}
            >
              + Añadir
            </button>
          </div>
        </div>
      </div>

      {/* ── Importes por categoría ── */}
      <div className={styles.regCard}>
        <div className={styles.regCardHeader}>
          3. Importes del día
          {activePlates.length > 0 && (
            <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 8, color: 'var(--color-text-muted)' }}>
              — se dividirán entre {activePlates.length} vehículo{activePlates.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className={styles.regCardBody} style={{ padding: 0 }}>
          <table className={styles.catTable}>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Total del día</th>
                <th>Por vehículo</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat}>
                  <td>
                    <span className={`${styles.categoryBadge} ${styles[`cat-${cat}` as keyof typeof styles]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      className={styles.catAmountInput}
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={amounts[cat]}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [cat]: e.target.value }))}
                    />
                    {' '}€
                  </td>
                  <td>
                    {activePlates.length > 0 && (parseFloat(amounts[cat]) || 0) > 0
                      ? `${perVehicleByCat(cat).toFixed(2)} €`
                      : '—'}
                  </td>
                </tr>
              ))}
              <tr className={styles.catTableTotal}>
                <td>Total</td>
                <td>{total.toFixed(2)} €</td>
                <td>
                  {activePlates.length > 0 && total > 0 ? `${perVehicle.toFixed(2)} €` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Trabajador + notas ── */}
      <div className={styles.regCard}>
        <div className={styles.regCardHeader}>4. Datos opcionales</div>
        <div className={styles.regCardBody}>
          <div className={styles.metaRow}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Trabajador</label>
              <input
                className="form-input"
                value={worker}
                onChange={(e) => setWorker(e.target.value)}
                placeholder="Nombre del trabajador"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Notas</label>
              <input
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del día…"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.regActions}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={saving || activePlates.length === 0 || total <= 0}
        >
          {saving ? 'Guardando…' : 'Guardar gastos del día'}
        </button>
      </div>
    </div>
  );
}

// ─── Historial Tab ────────────────────────────────────────────────────────────

function HistorialTab({ vehicles }: { vehicles: FleetVehicle[] }) {
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);
  const [editFields, setEditFields] = useState<Partial<DailyExpense & { amount: number | string }>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const canWrite = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (filterPlate) params.set('plate', filterPlate);
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`/api/gastos?${params}`);
      if (!res.ok) throw new Error('Error al cargar gastos');
      const data = await res.json();
      setExpenses(data.expenses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filterFrom, filterTo, filterPlate, filterCategory]);

  useEffect(() => {
    fetch('/api/me').then((r) => r.ok ? r.json() : {}).then((d) => setUserRole(d.role ?? ''));
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {});
  const activeCats = CATEGORIES.filter((c) => byCategory[c] > 0);
  const activePlates = vehicles.map((v) => v.plate);

  function openEdit(expense: DailyExpense) {
    setEditingExpense(expense);
    setEditFields({ date: expense.date, plate: expense.plate, category: expense.category, amount: expense.amount, worker: expense.worker ?? '', notes: expense.notes ?? '' });
    setEditError('');
  }

  async function handleEditSave() {
    if (!editingExpense) return;
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/gastos/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editFields.date, plate: editFields.plate, category: editFields.category, amount: Number(editFields.amount), worker: editFields.worker || undefined, notes: editFields.notes || undefined }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Error'); }
      setEditingExpense(null);
      await loadExpenses();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Error');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Error al eliminar'); return; }
    await loadExpenses();
  }

  return (
    <div>
      {/* Summary */}
      {activeCats.length > 0 && (
        <div className={styles.summaryBar}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>Total</div>
            <div className={styles.summaryValue}>{totalAmount.toFixed(2)} €</div>
          </div>
          {activeCats.map((cat) => (
            <div key={cat} className={styles.summaryItem}>
              <div className={styles.summaryLabel}>{CATEGORY_LABELS[cat]}</div>
              <div className={styles.summaryValue}>{byCategory[cat].toFixed(2)} €</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <DatePicker className="form-input" value={filterFrom} onChange={(v) => { setFilterFrom(v); setHasSearched(true); }} style={{ width: 'auto' }} />
        <DatePicker className="form-input" value={filterTo} onChange={(v) => { setFilterTo(v); setHasSearched(true); }} style={{ width: 'auto' }} />
        <input type="text" className="form-input" value={filterPlate} onChange={(e) => { setFilterPlate(e.target.value); setHasSearched(true); }} placeholder="Matrícula" style={{ width: 130 }} />
        <select className="form-select" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setHasSearched(true); }} style={{ width: 'auto' }}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => { setHasSearched(true); loadExpenses(); }}>Actualizar</button>
        {(filterFrom || filterTo || filterPlate || filterCategory) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterPlate(''); setFilterCategory(''); }}>
            Limpiar
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
        ) : loading ? (
          <div className={styles.loadingRow}>Cargando gastos…</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__text">No hay gastos que coincidan con los filtros.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Matrícula</th>
                <th>Categoría</th>
                <th>Importe</th>
                <th>Trabajador</th>
                <th>Notas</th>
                {canWrite && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td>
                  <td><span className={styles.plate}>{e.plate}</span></td>
                  <td>
                    <span className={`${styles.categoryBadge} ${styles[`cat-${e.category}` as keyof typeof styles]}`}>
                      {CATEGORY_LABELS[e.category]}
                    </span>
                  </td>
                  <td><span className={styles.amount}>{e.amount.toFixed(2)} €</span></td>
                  <td>{e.worker ?? '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes ?? '—'}</td>
                  {canWrite && (
                    <td>
                      <div className={styles.actions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>Editar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(e.id)} style={{ color: 'var(--color-danger)' }}>Eliminar</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editingExpense && (
        <div className="modal-overlay" onClick={() => setEditingExpense(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">Editar gasto</span>
              <button className="modal__close" onClick={() => setEditingExpense(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className={styles.editGrid}>
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <DatePicker className="form-input" value={String(editFields.date ?? '')} onChange={(v) => setEditFields((f) => ({ ...f, date: v }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Matrícula *</label>
                  <select className="form-select" value={String(editFields.plate ?? '')} onChange={(e) => setEditFields((f) => ({ ...f, plate: e.target.value }))}>
                    <option value="">— Seleccionar</option>
                    {activePlates.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select className="form-select" value={String(editFields.category ?? 'OTRO')} onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Importe (€) *</label>
                  <input type="number" className="form-input" min="0.01" step="0.01" value={String(editFields.amount ?? '')} onChange={(e) => setEditFields((f) => ({ ...f, amount: parseFloat(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Trabajador</label>
                  <input type="text" className="form-input" value={String(editFields.worker ?? '')} onChange={(e) => setEditFields((f) => ({ ...f, worker: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <input type="text" className="form-input" value={String(editFields.notes ?? '')} onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {editError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{editError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setEditingExpense(null)} disabled={editSaving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>{editSaving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'registrar' | 'historial';

export default function GastosPage() {
  const [tab, setTab] = useState<Tab>('registrar');
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/vehiculos/flota').then((r) => r.ok ? r.json() : { vehicles: [] }),
      fetch('/api/me').then((r) => r.ok ? r.json() : {}),
    ]).then(([vData, me]) => {
      setVehicles((vData.vehicles ?? []).filter((v: FleetVehicle) => v.active));
      setUserRole(me.role ?? '');
    });
  }, []);

  const canWrite = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gastos internos</h1>
          <p className="page-subtitle">Gastos operativos diarios — no facturables, asignados a vehículos</p>
        </div>
        {tab === 'historial' && <PrintButton />}
      </div>

      <nav className={styles.tabNav}>
        {([
          { key: 'registrar', label: 'Registrar gastos' },
          { key: 'historial', label: 'Historial' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'registrar' && <RegistrarTab vehicles={vehicles} canWrite={canWrite} />}
      {tab === 'historial' && <HistorialTab vehicles={vehicles} />}
    </div>
  );
}
