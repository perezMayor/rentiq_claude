'use client';

import { useState } from 'react';
import type { Contract, Client, VehicleCategory, CompanyBranch } from '@/src/lib/types';
import styles from './contratos.module.css';

type Props = {
  contract: Contract;
  clients: Client[];
  categories: VehicleCategory[];
  branches: CompanyBranch[];
  onClose: () => void;
  onUpdated: (updated: Contract) => void;
};

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calcPaid(contract: Contract): number {
  const paid = contract.payments.filter((p) => !p.isRefund).reduce((s, p) => s + p.amount, 0);
  const refunded = contract.payments.filter((p) => p.isRefund).reduce((s, p) => s + p.amount, 0);
  return paid - refunded;
}

function FuelSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.fuelSelector}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((v) => (
        <button
          key={v}
          type="button"
          className={`${styles.fuelOption} ${value === v ? styles.selected : ''}`}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export default function ContratoDetail({
  contract: initialContract,
  clients,
  categories,
  branches,
  onClose,
  onUpdated,
}: Props) {
  const [contract, setContract] = useState<Contract>(initialContract);
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active sub-form: 'checkout' | 'checkin' | 'pago' | null
  const [activeForm, setActiveForm] = useState<'checkout' | 'checkin' | 'pago' | null>(null);

  // Checkout form state
  const [coKmOut, setCoKmOut] = useState('');
  const [coFuelOut, setCoFuelOut] = useState(4);
  const [coNotes, setCoNotes] = useState('');

  // Checkin form state
  const [ciKmIn, setCiKmIn] = useState('');
  const [ciFuelIn, setCiFuelIn] = useState(4);
  const [ciNotes, setCiNotes] = useState('');

  // Payment form state
  const [paMethod, setPaMethod] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO'>('EFECTIVO');
  const [paAmount, setPaAmount] = useState('');
  const [paNotes, setPaNotes] = useState('');
  const [paIsRefund, setPaIsRefund] = useState(false);

  const client = clients.find((c) => c.id === contract.clientId);
  const category = categories.find((c) => c.id === contract.categoryId);
  const branch = branches.find((b) => b.id === contract.branchId);
  const netPaid = calcPaid(contract);
  const isPaidInFull = netPaid >= contract.total;

  const clientName = client
    ? `${client.name}${client.surname ? ' ' + client.surname : ''}`
    : contract.clientId;

  async function post(endpoint: string, body: Record<string, unknown>) {
    setSubmitting(true);
    setActionError('');
    try {
      const res = await fetch(`/api/contratos/${contract.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? 'Error desconocido');
        return null;
      }
      return data.contract as Contract;
    } catch {
      setActionError('Error de conexión');
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout() {
    const kmOut = parseInt(coKmOut, 10);
    if (isNaN(kmOut) || kmOut < 0) {
      setActionError('Introduce un valor válido para los kilómetros de salida');
      return;
    }
    const updated = await post('checkout', { kmOut, fuelOut: coFuelOut, notes: coNotes || undefined });
    if (updated) {
      setContract(updated);
      onUpdated(updated);
      setActiveForm(null);
      setCoKmOut('');
      setCoNotes('');
    }
  }

  async function handleCheckin() {
    const kmIn = parseInt(ciKmIn, 10);
    if (isNaN(kmIn) || kmIn < 0) {
      setActionError('Introduce un valor válido para los kilómetros de entrada');
      return;
    }
    const updated = await post('checkin', { kmIn, fuelIn: ciFuelIn, notes: ciNotes || undefined });
    if (updated) {
      setContract(updated);
      onUpdated(updated);
      setActiveForm(null);
      setCiKmIn('');
      setCiNotes('');
    }
  }

  async function handlePago() {
    const amount = parseFloat(paAmount);
    if (isNaN(amount) || amount <= 0) {
      setActionError('El importe debe ser un número mayor que 0');
      return;
    }
    const updated = await post('pago', {
      method: paMethod,
      amount,
      notes: paNotes || undefined,
      isRefund: paIsRefund,
    });
    if (updated) {
      setContract(updated);
      onUpdated(updated);
      setActiveForm(null);
      setPaAmount('');
      setPaNotes('');
      setPaIsRefund(false);
    }
  }

  async function handleCerrar() {
    if (!confirm('¿Cerrar este contrato? Se generará una factura automáticamente.')) return;
    const updated = await post('cerrar', {});
    if (updated) {
      setContract(updated);
      onUpdated(updated);
    }
  }

  async function handleCancelar() {
    const reason = prompt('Motivo de cancelación (opcional):');
    if (reason === null) return; // user dismissed
    setSubmitting(true);
    setActionError('');
    try {
      const res = await fetch(`/api/contratos/${contract.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? 'Error al cancelar');
        return;
      }
      const updated = data.contract as Contract;
      setContract(updated);
      onUpdated(updated);
    } catch {
      setActionError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  }

  const statusClass =
    contract.status === 'ABIERTO'
      ? styles.abierto
      : contract.status === 'CERRADO'
      ? styles.cerrado
      : styles.cancelado;

  const statusLabel =
    contract.status === 'ABIERTO'
      ? 'Abierto'
      : contract.status === 'CERRADO'
      ? 'Cerrado'
      : 'Cancelado';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="modal__title">{contract.number}</h2>
            <span className={`${styles.statusTag} ${statusClass}`}>{statusLabel}</span>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </div>

        <div className="modal__body">
          {/* Client & Vehicle */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Datos del contrato</p>
            <div className={styles.detailGrid}>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Cliente</span>
                <span className={styles.detailValue}>{clientName}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Sucursal</span>
                <span className={styles.detailValue}>{branch?.name ?? contract.branchId}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Matrícula</span>
                <span className={styles.detailValue}>{contract.plate}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Categoría</span>
                <span className={styles.detailValue}>{category?.name ?? contract.categoryId}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Lugar de entrega</span>
                <span className={styles.detailValue}>{contract.pickupLocation || '—'}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Lugar de recogida</span>
                <span className={styles.detailValue}>{contract.returnLocation || '—'}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Inicio</span>
                <span className={styles.detailValue}>{formatDate(contract.startDate)} {contract.startTime}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Fin</span>
                <span className={styles.detailValue}>{formatDate(contract.endDate)} {contract.endTime}</span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>Días facturados</span>
                <span className={styles.detailValue}>{contract.billedDays}</span>
              </div>
              {contract.invoiceId && (
                <div className={styles.detailField}>
                  <span className={styles.detailLabel}>Factura</span>
                  <span className={styles.detailValue}>{contract.invoiceId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Economic breakdown */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Desglose económico</p>
            <div className={styles.amountBreakdown}>
              <div className={styles.amountRow}>
                <span>Base ({contract.billedDays} días)</span>
                <span>{contract.basePrice.toFixed(2)} €</span>
              </div>
              {contract.extrasTotal > 0 && (
                <div className={styles.amountRow}>
                  <span>Extras</span>
                  <span>{contract.extrasTotal.toFixed(2)} €</span>
                </div>
              )}
              {contract.insuranceTotal > 0 && (
                <div className={styles.amountRow}>
                  <span>Seguros</span>
                  <span>{contract.insuranceTotal.toFixed(2)} €</span>
                </div>
              )}
              {contract.fuelCharge > 0 && (
                <div className={styles.amountRow}>
                  <span>Cargo combustible</span>
                  <span>{contract.fuelCharge.toFixed(2)} €</span>
                </div>
              )}
              {contract.penalties > 0 && (
                <div className={styles.amountRow}>
                  <span>Penalizaciones</span>
                  <span>{contract.penalties.toFixed(2)} €</span>
                </div>
              )}
              {contract.discount > 0 && (
                <div className={`${styles.amountRow} ${styles.discount}`}>
                  <span>Descuento</span>
                  <span>-{contract.discount.toFixed(2)} €</span>
                </div>
              )}
              <div className={`${styles.amountRow} ${styles.total}`}>
                <span>Total</span>
                <span>{contract.total.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Checkout */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Checkout (entrega)</p>
            {contract.checkout ? (
              <div className={styles.detailGrid}>
                <div className={styles.detailField}>
                  <span className={styles.detailLabel}>Fecha y hora</span>
                  <span className={styles.detailValue}>{formatDateTime(contract.checkout.doneAt)}</span>
                </div>
                <div className={styles.detailField}>
                  <span className={styles.detailLabel}>Km salida</span>
                  <span className={styles.detailValue}>{contract.checkout.kmOut.toLocaleString('es-ES')}</span>
                </div>
                <div className={styles.detailField}>
                  <span className={styles.detailLabel}>Combustible salida</span>
                  <span className={styles.detailValue}>{contract.checkout.fuelOut}/8</span>
                </div>
                {contract.checkout.notes && (
                  <div className={`${styles.detailField} col-span-2`}>
                    <span className={styles.detailLabel}>Notas</span>
                    <span className={styles.detailValue}>{contract.checkout.notes}</span>
                  </div>
                )}
              </div>
            ) : contract.status === 'ABIERTO' ? (
              <>
                {activeForm !== 'checkout' ? (
                  <button
                    className="btn btn-accent btn-sm"
                    onClick={() => { setActiveForm('checkout'); setActionError(''); }}
                  >
                    Registrar Checkout
                  </button>
                ) : (
                  <div className={styles.actionForm}>
                    <p className={styles.actionFormTitle}>Datos de entrega del vehículo</p>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Km salida *</label>
                        <input
                          type="number"
                          className="form-input"
                          value={coKmOut}
                          onChange={(e) => setCoKmOut(e.target.value)}
                          min={0}
                          placeholder="ej: 45000"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Combustible (0-8) *</label>
                        <FuelSelector value={coFuelOut} onChange={setCoFuelOut} />
                      </div>
                      <div className="form-group col-span-2">
                        <label className="form-label">Notas</label>
                        <input
                          type="text"
                          className="form-input"
                          value={coNotes}
                          onChange={(e) => setCoNotes(e.target.value)}
                          placeholder="Observaciones opcionales"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-accent btn-sm" onClick={handleCheckout} disabled={submitting}>
                        {submitting ? 'Guardando…' : 'Confirmar Checkout'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setActiveForm(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No registrado</span>
            )}
          </div>

          {/* Checkin */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Checkin (recogida)</p>
            {contract.checkin ? (
              <div className={styles.detailGrid}>
                <div className={styles.detailField}>
                  <span className={styles.detailLabel}>Fecha y hora</span>
                  <span className={styles.detailValue}>{formatDateTime(contract.checkin.doneAt)}</span>
                </div>
                <div className={styles.detailField}>
                  <span className={styles.detailLabel}>Km entrada</span>
                  <span className={styles.detailValue}>{contract.checkin.kmIn.toLocaleString('es-ES')}</span>
                </div>
                <div className={styles.detailField}>
                  <span className={styles.detailLabel}>Combustible entrada</span>
                  <span className={styles.detailValue}>{contract.checkin.fuelIn}/8</span>
                </div>
                {contract.checkout && (
                  <div className={styles.detailField}>
                    <span className={styles.detailLabel}>Km recorridos</span>
                    <span className={styles.detailValue}>
                      {(contract.checkin.kmIn - contract.checkout.kmOut).toLocaleString('es-ES')} km
                    </span>
                  </div>
                )}
                {contract.checkin.notes && (
                  <div className={`${styles.detailField} col-span-2`}>
                    <span className={styles.detailLabel}>Notas</span>
                    <span className={styles.detailValue}>{contract.checkin.notes}</span>
                  </div>
                )}
              </div>
            ) : contract.status === 'ABIERTO' && contract.checkout ? (
              <>
                {activeForm !== 'checkin' ? (
                  <button
                    className="btn btn-accent btn-sm"
                    onClick={() => { setActiveForm('checkin'); setActionError(''); }}
                  >
                    Registrar Checkin
                  </button>
                ) : (
                  <div className={styles.actionForm}>
                    <p className={styles.actionFormTitle}>Datos de recogida del vehículo</p>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Km entrada * (min: {contract.checkout.kmOut})</label>
                        <input
                          type="number"
                          className="form-input"
                          value={ciKmIn}
                          onChange={(e) => setCiKmIn(e.target.value)}
                          min={contract.checkout.kmOut}
                          placeholder={String(contract.checkout.kmOut)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Combustible (0-8) *</label>
                        <FuelSelector value={ciFuelIn} onChange={setCiFuelIn} />
                      </div>
                      <div className="form-group col-span-2">
                        <label className="form-label">Notas</label>
                        <input
                          type="text"
                          className="form-input"
                          value={ciNotes}
                          onChange={(e) => setCiNotes(e.target.value)}
                          placeholder="Observaciones opcionales"
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-accent btn-sm" onClick={handleCheckin} disabled={submitting}>
                        {submitting ? 'Guardando…' : 'Confirmar Checkin'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setActiveForm(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {contract.status === 'ABIERTO' && !contract.checkout
                  ? 'Pendiente de checkout'
                  : 'No registrado'}
              </span>
            )}
          </div>

          {/* Payments */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Caja y pagos</p>
            {contract.payments.length > 0 ? (
              <div className={styles.paymentList}>
                {contract.payments.map((p) => (
                  <div key={p.id} className={`${styles.paymentItem} ${p.isRefund ? styles.refund : ''}`}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{p.method}</span>
                      {p.isRefund && (
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--color-danger)', fontWeight: 700 }}>
                          DEVOLUCIÓN
                        </span>
                      )}
                      {p.notes && <div className={styles.paymentMeta}>{p.notes}</div>}
                      <div className={styles.paymentMeta}>{formatDateTime(p.recordedAt)}</div>
                    </div>
                    <span className={`${styles.paymentAmount} ${p.isRefund ? styles.refundAmount : ''}`}>
                      {p.isRefund ? '-' : ''}{p.amount.toFixed(2)} €
                    </span>
                  </div>
                ))}
                <div className={`${styles.paymentSummary} ${isPaidInFull ? styles.paid : styles.underpaid}`}>
                  <span>Cobrado / Total</span>
                  <span>{netPaid.toFixed(2)} € / {contract.total.toFixed(2)} €</span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                Sin pagos registrados
              </p>
            )}

            {contract.status === 'ABIERTO' && (
              <div style={{ marginTop: 12 }}>
                {activeForm !== 'pago' ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setActiveForm('pago'); setActionError(''); }}
                  >
                    + Registrar Pago
                  </button>
                ) : (
                  <div className={styles.actionForm}>
                    <p className={styles.actionFormTitle}>Nuevo pago</p>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Método *</label>
                        <select
                          className="form-select"
                          value={paMethod}
                          onChange={(e) => setPaMethod(e.target.value as typeof paMethod)}
                        >
                          <option value="EFECTIVO">Efectivo</option>
                          <option value="TARJETA">Tarjeta</option>
                          <option value="TRANSFERENCIA">Transferencia</option>
                          <option value="OTRO">Otro</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Importe (€) *</label>
                        <input
                          type="number"
                          className="form-input"
                          value={paAmount}
                          onChange={(e) => setPaAmount(e.target.value)}
                          min={0.01}
                          step={0.01}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="form-group col-span-2">
                        <label className="form-label">Notas</label>
                        <input
                          type="text"
                          className="form-input"
                          value={paNotes}
                          onChange={(e) => setPaNotes(e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>
                      <div className="form-group col-span-2">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={paIsRefund}
                            onChange={(e) => setPaIsRefund(e.target.checked)}
                          />
                          <span className="form-label" style={{ margin: 0 }}>Es devolución</span>
                        </label>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-primary btn-sm" onClick={handlePago} disabled={submitting}>
                        {submitting ? 'Guardando…' : 'Confirmar Pago'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setActiveForm(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {contract.notes && (
            <div className={styles.detailSection}>
              <p className={styles.detailSectionTitle}>Observaciones</p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                {contract.notes}
              </p>
            </div>
          )}

          {/* Audit log */}
          <div className={styles.detailSection}>
            <p className={styles.detailSectionTitle}>Historial</p>
            <div className={styles.auditLog}>
              {[...contract.auditLog].reverse().map((entry, i) => (
                <div key={i} className={styles.auditEntry}>
                  <span className={styles.auditAction}>{entry.action}</span>
                  <span>{entry.detail}</span>
                  <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {formatDateTime(entry.at)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error message */}
          {actionError && (
            <div className="alert alert-danger">
              {actionError}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="modal__footer">
          {contract.status === 'ABIERTO' && contract.checkin && isPaidInFull && (
            <button
              className="btn btn-primary"
              onClick={handleCerrar}
              disabled={submitting}
            >
              {submitting ? 'Cerrando…' : 'Cerrar Contrato'}
            </button>
          )}
          {contract.status === 'ABIERTO' && (
            <button
              className="btn btn-danger"
              onClick={handleCancelar}
              disabled={submitting}
              style={{ marginLeft: 'auto' }}
            >
              Cancelar Contrato
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose} style={{ marginLeft: contract.status !== 'ABIERTO' ? 'auto' : undefined }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
