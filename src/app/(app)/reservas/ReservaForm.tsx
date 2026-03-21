'use client';

import { useState } from 'react';
import type { Reservation, Client, VehicleCategory, CompanyBranch } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';

interface Props {
  reservation: Reservation | null;
  clients: Client[];
  categories: VehicleCategory[];
  branches: CompanyBranch[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ReservaForm({
  reservation,
  clients,
  categories,
  branches,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!reservation;

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    branchId: reservation?.branchId ?? branches[0]?.id ?? '',
    pickupLocation: reservation?.pickupLocation ?? '',
    returnLocation: reservation?.returnLocation ?? '',
    clientId: reservation?.clientId ?? '',
    categoryId: reservation?.categoryId ?? categories[0]?.id ?? '',
    requestedModelId: reservation?.requestedModelId ?? '',
    assignedPlate: reservation?.assignedPlate ?? '',
    startDate: reservation?.startDate ?? today,
    startTime: reservation?.startTime ?? '09:00',
    endDate: reservation?.endDate ?? today,
    endTime: reservation?.endTime ?? '09:00',
    billedDays: String(reservation?.billedDays ?? 1),
    basePrice: String(reservation?.basePrice ?? 0),
    extrasTotal: String(reservation?.extrasTotal ?? 0),
    insuranceTotal: String(reservation?.insuranceTotal ?? 0),
    fuelCharge: String(reservation?.fuelCharge ?? 0),
    penalties: String(reservation?.penalties ?? 0),
    discount: String(reservation?.discount ?? 0),
    total: String(reservation?.total ?? 0),
    notes: reservation?.notes ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function recalcTotal() {
    const base = parseFloat(form.basePrice) || 0;
    const extras = parseFloat(form.extrasTotal) || 0;
    const ins = parseFloat(form.insuranceTotal) || 0;
    const fuel = parseFloat(form.fuelCharge) || 0;
    const pen = parseFloat(form.penalties) || 0;
    const disc = parseFloat(form.discount) || 0;
    const total = base + extras + ins + fuel + pen - disc;
    setForm((prev) => ({ ...prev, total: total.toFixed(2) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        branchId: form.branchId,
        pickupLocation: form.pickupLocation,
        returnLocation: form.returnLocation,
        clientId: form.clientId,
        categoryId: form.categoryId,
        requestedModelId: form.requestedModelId || undefined,
        assignedPlate: form.assignedPlate || undefined,
        startDate: form.startDate,
        startTime: form.startTime,
        endDate: form.endDate,
        endTime: form.endTime,
        billedDays: parseInt(form.billedDays) || 1,
        basePrice: parseFloat(form.basePrice) || 0,
        extrasTotal: parseFloat(form.extrasTotal) || 0,
        insuranceTotal: parseFloat(form.insuranceTotal) || 0,
        fuelCharge: parseFloat(form.fuelCharge) || 0,
        penalties: parseFloat(form.penalties) || 0,
        discount: parseFloat(form.discount) || 0,
        total: parseFloat(form.total) || 0,
        notes: form.notes || undefined,
      };

      const url = isEdit ? `/api/reservas/${reservation!.id}` : '/api/reservas';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al guardar');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">
            {isEdit ? `Editar Reserva ${reservation!.number}` : 'Nueva Reserva'}
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="form-grid">
              {/* Sucursal gestora */}
              <div className="form-group">
                <label className="form-label">Sucursal gestora *</label>
                <select
                  className="form-select"
                  value={form.branchId}
                  onChange={(e) => set('branchId', e.target.value)}
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Cliente */}
              <div className="form-group">
                <label className="form-label">Cliente *</label>
                <select
                  className="form-select"
                  value={form.clientId}
                  onChange={(e) => set('clientId', e.target.value)}
                  required
                >
                  <option value="">— Seleccionar cliente —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.surname ? ' ' + c.surname : ''}{c.nif ? ` (${c.nif})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoría */}
              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select
                  className="form-select"
                  value={form.categoryId}
                  onChange={(e) => set('categoryId', e.target.value)}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Matrícula asignada */}
              <div className="form-group">
                <label className="form-label">Matrícula asignada</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.assignedPlate}
                  onChange={(e) => set('assignedPlate', e.target.value.toUpperCase())}
                  placeholder="1234ABC"
                />
              </div>

              {/* Lugar de entrega */}
              <div className="form-group">
                <label className="form-label">Lugar de entrega</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.pickupLocation}
                  onChange={(e) => set('pickupLocation', e.target.value)}
                  placeholder="Dirección o punto de entrega"
                />
              </div>

              {/* Lugar de recogida */}
              <div className="form-group">
                <label className="form-label">Lugar de recogida</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.returnLocation}
                  onChange={(e) => set('returnLocation', e.target.value)}
                  placeholder="Dirección o punto de recogida"
                />
              </div>

              {/* Fecha entrada */}
              <div className="form-group">
                <label className="form-label">Fecha entrada *</label>
                <DatePicker
                  className="form-input"
                  value={form.startDate}
                  onChange={(v) => set('startDate', v)}
                />
              </div>

              {/* Hora entrada */}
              <div className="form-group">
                <label className="form-label">Hora entrada *</label>
                <input
                  type="time"
                  className="form-input"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                  required
                />
              </div>

              {/* Fecha salida */}
              <div className="form-group">
                <label className="form-label">Fecha salida *</label>
                <DatePicker
                  className="form-input"
                  value={form.endDate}
                  onChange={(v) => set('endDate', v)}
                />
              </div>

              {/* Hora salida */}
              <div className="form-group">
                <label className="form-label">Hora salida *</label>
                <input
                  type="time"
                  className="form-input"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                  required
                />
              </div>

              {/* Días facturados */}
              <div className="form-group">
                <label className="form-label">Días facturados *</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.billedDays}
                  onChange={(e) => set('billedDays', e.target.value)}
                  min="1"
                  required
                />
              </div>

              {/* Base */}
              <div className="form-group">
                <label className="form-label">Precio base (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.basePrice}
                  onChange={(e) => set('basePrice', e.target.value)}
                  min="0"
                  step="0.01"
                  onBlur={recalcTotal}
                />
              </div>

              {/* Extras */}
              <div className="form-group">
                <label className="form-label">Extras (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.extrasTotal}
                  onChange={(e) => set('extrasTotal', e.target.value)}
                  min="0"
                  step="0.01"
                  onBlur={recalcTotal}
                />
              </div>

              {/* Seguro */}
              <div className="form-group">
                <label className="form-label">Seguro (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.insuranceTotal}
                  onChange={(e) => set('insuranceTotal', e.target.value)}
                  min="0"
                  step="0.01"
                  onBlur={recalcTotal}
                />
              </div>

              {/* Combustible */}
              <div className="form-group">
                <label className="form-label">Combustible (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.fuelCharge}
                  onChange={(e) => set('fuelCharge', e.target.value)}
                  min="0"
                  step="0.01"
                  onBlur={recalcTotal}
                />
              </div>

              {/* Penalizaciones */}
              <div className="form-group">
                <label className="form-label">Penalizaciones (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.penalties}
                  onChange={(e) => set('penalties', e.target.value)}
                  min="0"
                  step="0.01"
                  onBlur={recalcTotal}
                />
              </div>

              {/* Descuento */}
              <div className="form-group">
                <label className="form-label">Descuento (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.discount}
                  onChange={(e) => set('discount', e.target.value)}
                  min="0"
                  step="0.01"
                  onBlur={recalcTotal}
                />
              </div>

              {/* Total */}
              <div className="form-group">
                <label className="form-label">Total (€)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.total}
                  onChange={(e) => set('total', e.target.value)}
                  min="0"
                  step="0.01"
                  style={{ fontWeight: 600 }}
                />
              </div>

              {/* Notas */}
              <div className="form-group col-span-2">
                <label className="form-label">Notas</label>
                <textarea
                  className="form-textarea"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Observaciones internas…"
                />
              </div>
            </div>
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
