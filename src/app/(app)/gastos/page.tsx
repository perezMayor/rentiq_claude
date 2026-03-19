'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailyExpense, ExpenseCategory, FleetVehicle } from '@/src/lib/types';
import styles from './gastos.module.css';

const CATEGORIES: ExpenseCategory[] = ['PEAJE', 'GASOLINA', 'COMIDA', 'PARKING', 'LAVADO', 'OTRO'];
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  PEAJE: 'Peaje',
  GASOLINA: 'Gasolina',
  COMIDA: 'Comida',
  PARKING: 'Parking',
  LAVADO: 'Lavado',
  OTRO: 'Otro',
};

type ExpenseItem = {
  plate: string;
  category: ExpenseCategory;
  amount: string;
  worker: string;
  notes: string;
};

function emptyItem(): ExpenseItem {
  return { plate: '', category: 'PEAJE', amount: '', worker: '', notes: '' };
}

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export default function GastosPage() {
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterWorker, setFilterWorker] = useState('');

  // Batch form
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchDate, setBatchDate] = useState(todayStr);
  const [batchItems, setBatchItems] = useState<ExpenseItem[]>([emptyItem()]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState('');

  // Edit modal
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
      if (filterWorker) params.set('worker', filterWorker);

      const res = await fetch(`/api/gastos?${params}`);
      if (!res.ok) throw new Error('Error al cargar gastos');
      const data = await res.json();
      setExpenses(data.expenses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filterFrom, filterTo, filterPlate, filterCategory, filterWorker]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [vehiclesRes, meRes] = await Promise.all([
          fetch('/api/vehiculos/flota'),
          fetch('/api/me'),
        ]);
        if (vehiclesRes.ok) {
          const data = await vehiclesRes.json();
          setVehicles((data.vehicles ?? []).filter((v: FleetVehicle) => v.active));
        }
        if (meRes.ok) {
          const me = await meRes.json();
          setUserRole(me.role ?? '');
        }
      } catch {
        // non-critical
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Batch form handlers
  function updateItem(idx: number, field: keyof ExpenseItem, value: string) {
    setBatchItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setBatchItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setBatchItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleBatchSubmit() {
    setBatchError('');
    for (const item of batchItems) {
      if (!item.plate) { setBatchError('Completa la matrícula en todas las filas'); return; }
      if (!item.amount || Number(item.amount) <= 0) { setBatchError('El importe debe ser mayor que 0'); return; }
    }

    setBatchSaving(true);
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: batchDate,
          items: batchItems.map((it) => ({
            plate: it.plate,
            category: it.category,
            amount: parseFloat(it.amount),
            worker: it.worker || undefined,
            notes: it.notes || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      setShowBatchForm(false);
      setBatchItems([emptyItem()]);
      setBatchDate(todayStr());
      await loadExpenses();
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBatchSaving(false);
    }
  }

  // Edit handlers
  function openEdit(expense: DailyExpense) {
    setEditingExpense(expense);
    setEditFields({
      date: expense.date,
      plate: expense.plate,
      category: expense.category,
      amount: expense.amount,
      worker: expense.worker ?? '',
      notes: expense.notes ?? '',
    });
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
        body: JSON.stringify({
          date: editFields.date,
          plate: editFields.plate,
          category: editFields.category,
          amount: Number(editFields.amount),
          worker: editFields.worker || undefined,
          notes: editFields.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      setEditingExpense(null);
      await loadExpenses();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Error al eliminar');
        return;
      }
      await loadExpenses();
    } catch {
      alert('Error de red');
    }
  }

  // Summary calculations
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {});
  const activeCats = CATEGORIES.filter((c) => byCategory[c] > 0);

  const activePlates = vehicles.map((v) => v.plate);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gastos</h1>
          <p className="page-subtitle">
            {expenses.length} gasto{expenses.length !== 1 ? 's' : ''} ·{' '}
            Total: {totalAmount.toFixed(2)} €
          </p>
        </div>
        {canWrite && (
          <button
            className="btn btn-primary"
            onClick={() => { setShowBatchForm(true); setBatchError(''); }}
          >
            + Registrar gastos
          </button>
        )}
      </div>

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

      {/* Batch form */}
      {showBatchForm && (
        <div className={styles.batchForm}>
          <div className={styles.batchFormTitle}>Registrar gastos del día</div>
          <div className={styles.batchDateRow}>
            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input
                type="date"
                className="form-input"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
              />
            </div>
          </div>

          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Matrícula *</th>
                <th style={{ width: 130 }}>Categoría *</th>
                <th style={{ width: 110 }}>Importe (€) *</th>
                <th style={{ width: 130 }}>Trabajador</th>
                <th>Notas</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {batchItems.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <select
                      value={item.plate}
                      onChange={(e) => updateItem(idx, 'plate', e.target.value)}
                    >
                      <option value="">-- Matrícula</option>
                      {activePlates.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(idx, 'category', e.target.value as ExpenseCategory)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={item.amount}
                      onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={item.worker}
                      onChange={(e) => updateItem(idx, 'worker', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Observaciones"
                      value={item.notes}
                      onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                    />
                  </td>
                  <td>
                    {batchItems.length > 1 && (
                      <button
                        className={styles.removeRow}
                        onClick={() => removeItem(idx)}
                        title="Eliminar fila"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className={`btn btn-ghost btn-sm ${styles.addRowBtn}`}
            onClick={addItem}
          >
            + Añadir fila
          </button>

          {batchError && <div className="alert alert-danger" style={{ marginTop: 12 }}>{batchError}</div>}

          <div className={styles.batchFormActions}>
            <button
              className="btn btn-ghost"
              onClick={() => { setShowBatchForm(false); setBatchItems([emptyItem()]); }}
              disabled={batchSaving}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleBatchSubmit}
              disabled={batchSaving}
            >
              {batchSaving ? 'Guardando…' : 'Guardar gastos'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="date"
          className="form-input"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          style={{ width: 'auto' }}
          title="Desde"
        />
        <input
          type="date"
          className="form-input"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          style={{ width: 'auto' }}
          title="Hasta"
        />
        <input
          type="text"
          className="form-input"
          value={filterPlate}
          onChange={(e) => setFilterPlate(e.target.value)}
          placeholder="Matrícula"
          style={{ width: 140 }}
        />
        <select
          className="form-select"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-input"
          value={filterWorker}
          onChange={(e) => setFilterWorker(e.target.value)}
          placeholder="Trabajador"
          style={{ width: 150 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={loadExpenses}>
          Actualizar
        </button>
        {(filterFrom || filterTo || filterPlate || filterCategory || filterWorker) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setFilterFrom('');
              setFilterTo('');
              setFilterPlate('');
              setFilterCategory('');
              setFilterWorker('');
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className={styles.loadingRow}>Cargando gastos…</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🧾</div>
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
                  <td>
                    <span className={styles.plate}>{e.plate}</span>
                  </td>
                  <td>
                    <span className={`${styles.categoryBadge} ${styles[`cat-${e.category}` as keyof typeof styles]}`}>
                      {CATEGORY_LABELS[e.category]}
                    </span>
                  </td>
                  <td>
                    <span className={styles.amount}>{e.amount.toFixed(2)} €</span>
                  </td>
                  <td>{e.worker ?? '—'}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.notes ?? '—'}
                  </td>
                  {canWrite && (
                    <td>
                      <div className={styles.actions}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(e)}
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(e.id)}
                          title="Eliminar"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          Eliminar
                        </button>
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
                  <input
                    type="date"
                    className="form-input"
                    value={String(editFields.date ?? '')}
                    onChange={(e) => setEditFields((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Matrícula *</label>
                  <select
                    className="form-select"
                    value={String(editFields.plate ?? '')}
                    onChange={(e) => setEditFields((f) => ({ ...f, plate: e.target.value }))}
                  >
                    <option value="">-- Seleccionar</option>
                    {activePlates.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select
                    className="form-select"
                    value={String(editFields.category ?? 'OTRO')}
                    onChange={(e) => setEditFields((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Importe (€) *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0.01"
                    step="0.01"
                    value={String(editFields.amount ?? '')}
                    onChange={(e) => setEditFields((f) => ({ ...f, amount: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Trabajador</label>
                  <input
                    type="text"
                    className="form-input"
                    value={String(editFields.worker ?? '')}
                    onChange={(e) => setEditFields((f) => ({ ...f, worker: e.target.value }))}
                    placeholder="Nombre del trabajador"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <input
                    type="text"
                    className="form-input"
                    value={String(editFields.notes ?? '')}
                    onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Observaciones"
                  />
                </div>
              </div>
              {editError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{editError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setEditingExpense(null)} disabled={editSaving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
