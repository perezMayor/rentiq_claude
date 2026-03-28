'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import type {
  Invoice,
  InvoiceStatus,
  Client,
  CompanyBranch,
  Contract,
} from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import styles from './facturacion.module.css';
import PrintButton from '@/src/components/PrintButton';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BORRADOR: 'Borrador',
  FINAL: 'Final',
};

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  BORRADOR: 'badge-peticion',
  FINAL: 'badge-cerrado',
};

type InvoiceDetail = {
  invoice: Invoice;
  contract?: Contract;
  client?: Client;
  branch?: CompanyBranch;
};

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function FacturacionContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Detail modal
  const [selectedDetail, setSelectedDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Finalizar
  const [finalizingSaving, setFinalizingSaving] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  // Email
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const canWrite = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterBranch) params.set('branchId', filterBranch);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (filterSearch) params.set('search', filterSearch);

      const res = await fetch(`/api/facturas?${params}`);
      if (!res.ok) throw new Error('Error al cargar facturas');
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterBranch, filterFrom, filterTo, filterSearch]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [clientsRes, branchesRes, meRes] = await Promise.all([
          fetch('/api/clientes'),
          fetch('/api/sucursales'),
          fetch('/api/me'),
        ]);
        if (clientsRes.ok) setClients((await clientsRes.json()).clients ?? []);
        if (branchesRes.ok) setBranches((await branchesRes.json()).branches ?? []);
        if (meRes.ok) setUserRole((await meRes.json()).role ?? '');
      } catch {
        // non-critical
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const clientMap = Object.fromEntries(
    clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`])
  );
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  async function openDetail(invoiceId: string) {
    setDetailLoading(true);
    setFinalizeError('');
    setEmailFeedback(null);
    try {
      const res = await fetch(`/api/facturas/${invoiceId}`);
      if (!res.ok) throw new Error('Error al cargar detalle');
      const data = await res.json();
      setSelectedDetail(data);
    } catch {
      // silently fail
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSendInvoiceEmail() {
    if (!selectedDetail) return;
    setSendingEmail(true);
    setEmailFeedback(null);
    try {
      const res = await fetch(`/api/email/factura/${selectedDetail.invoice.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar');
      const clientEmail = selectedDetail.client?.email ?? '—';
      setEmailFeedback({ ok: true, msg: `Factura enviada a ${clientEmail}` });
    } catch (e) {
      setEmailFeedback({ ok: false, msg: e instanceof Error ? e.message : 'Error desconocido' });
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleFinalizar() {
    if (!selectedDetail) return;
    setFinalizingSaving(true);
    setFinalizeError('');
    try {
      const res = await fetch(`/api/facturas/${selectedDetail.invoice.id}/finalizar`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');

      // Refresh detail and list
      setSelectedDetail((prev) =>
        prev ? { ...prev, invoice: data.invoice } : null
      );
      setInvoices((prev) =>
        prev.map((i) => (i.id === data.invoice.id ? data.invoice : i))
      );
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setFinalizingSaving(false);
    }
  }

  const totalBorradores = invoices.filter((i) => i.status === 'BORRADOR').length;
  const totalFinal = invoices.filter((i) => i.status === 'FINAL').length;
  const sumTotal = invoices.reduce((s, i) => s + i.total, 0);

  return (
    <div>
      {/* KPI */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-card__label">Total facturas</div>
          <div className="kpi-card__value">{invoices.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Borradores</div>
          <div className="kpi-card__value" style={{ color: 'var(--color-status-peticion)' }}>{totalBorradores}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Finalizadas</div>
          <div className="kpi-card__value" style={{ color: 'var(--color-status-contratado)' }}>{totalFinal}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Importe total</div>
          <div className="kpi-card__value" style={{ fontSize: '1.4rem' }}>{sumTotal.toFixed(2)} €</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setHasSearched(true); }}
          style={{ width: 'auto' }}
        >
          <option value="">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="FINAL">Final</option>
        </select>
        {branches.length > 1 && (
          <select
            className="form-select"
            value={filterBranch}
            onChange={(e) => { setFilterBranch(e.target.value); setHasSearched(true); }}
            style={{ width: 'auto' }}
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <DatePicker
          className="form-input"
          value={filterFrom}
          onChange={(v) => { setFilterFrom(v); setHasSearched(true); }}
          style={{ width: 'auto' }}
        />
        <DatePicker
          className="form-input"
          value={filterTo}
          onChange={(v) => { setFilterTo(v); setHasSearched(true); }}
          style={{ width: 'auto' }}
        />
        <input
          type="search"
          className="form-input"
          value={filterSearch}
          onChange={(e) => { setFilterSearch(e.target.value); setHasSearched(true); }}
          placeholder="Buscar número, contrato, cliente…"
          style={{ minWidth: 200 }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => { setHasSearched(true); loadInvoices(); }}>
          Listar
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
        ) : loading ? (
          <div className={styles.loadingRow}>Cargando facturas…</div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🧾</div>
            <div className="empty-state__text">
              No hay facturas que coincidan con los filtros. Las facturas se generan automáticamente al cerrar un contrato.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Cliente</th>
                {branches.length > 1 && <th>Sucursal</th>}
                <th>Base imponible</th>
                <th>IVA</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span className={styles.number}>{inv.number}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.date)}</td>
                  <td>{clientMap[inv.clientId] ?? inv.clientId}</td>
                  {branches.length > 1 && <td>{branchMap[inv.branchId] ?? inv.branchId}</td>}
                  <td>
                    <span className={styles.amount}>
                      {(inv.baseAmount + inv.extrasAmount + inv.insuranceAmount + inv.fuelAmount + inv.penalties - inv.discount).toFixed(2)} €
                    </span>
                  </td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {inv.ivaAmount.toFixed(2)} € ({inv.ivaPercent}%)
                  </td>
                  <td>
                    <span className={styles.amount}>{inv.total.toFixed(2)} €</span>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openDetail(inv.id)}
                        disabled={detailLoading}
                      >
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {selectedDetail && (
        <div className="modal-overlay" onClick={() => setSelectedDetail(null)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">
                Factura {selectedDetail.invoice.number}
                {' '}
                <span className={`badge ${STATUS_BADGE[selectedDetail.invoice.status]}`}>
                  {STATUS_LABELS[selectedDetail.invoice.status]}
                </span>
              </span>
              <button className="modal__close" onClick={() => setSelectedDetail(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className={styles.invoiceDetail}>
                {/* Header info */}
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Datos generales</div>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailField}>
                      <div className={styles.detailLabel}>Número</div>
                      <div className={styles.detailValue}>{selectedDetail.invoice.number}</div>
                    </div>
                    <div className={styles.detailField}>
                      <div className={styles.detailLabel}>Fecha</div>
                      <div className={styles.detailValue}>{formatDate(selectedDetail.invoice.date)}</div>
                    </div>
                    <div className={styles.detailField}>
                      <div className={styles.detailLabel}>Cliente</div>
                      <div className={styles.detailValue}>
                        {selectedDetail.client
                          ? `${selectedDetail.client.name}${selectedDetail.client.surname ? ' ' + selectedDetail.client.surname : ''}`
                          : selectedDetail.invoice.clientId}
                      </div>
                    </div>
                    <div className={styles.detailField}>
                      <div className={styles.detailLabel}>Sucursal</div>
                      <div className={styles.detailValue}>
                        {selectedDetail.branch?.name ?? selectedDetail.invoice.branchId}
                      </div>
                    </div>
                    <div className={styles.detailField}>
                      <div className={styles.detailLabel}>Contrato origen</div>
                      <div className={styles.detailValue}>
                        {selectedDetail.contract?.number ?? selectedDetail.invoice.contractId}
                      </div>
                    </div>
                    <div className={styles.detailField}>
                      <div className={styles.detailLabel}>Estado</div>
                      <div className={styles.detailValue}>
                        <span className={`badge ${STATUS_BADGE[selectedDetail.invoice.status]}`}>
                          {STATUS_LABELS[selectedDetail.invoice.status]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>Desglose</div>
                  <table className={styles.breakdownTable}>
                    <tbody>
                      {selectedDetail.invoice.baseAmount > 0 && (
                        <tr>
                          <td>Alquiler base ({selectedDetail.contract?.billedDays ?? '?'} días)</td>
                          <td>{selectedDetail.invoice.baseAmount.toFixed(2)} €</td>
                        </tr>
                      )}
                      {selectedDetail.invoice.extrasAmount > 0 && (
                        <tr>
                          <td>Extras</td>
                          <td>{selectedDetail.invoice.extrasAmount.toFixed(2)} €</td>
                        </tr>
                      )}
                      {selectedDetail.invoice.insuranceAmount > 0 && (
                        <tr>
                          <td>Seguros</td>
                          <td>{selectedDetail.invoice.insuranceAmount.toFixed(2)} €</td>
                        </tr>
                      )}
                      {selectedDetail.invoice.fuelAmount > 0 && (
                        <tr>
                          <td>Combustible</td>
                          <td>{selectedDetail.invoice.fuelAmount.toFixed(2)} €</td>
                        </tr>
                      )}
                      {selectedDetail.invoice.penalties > 0 && (
                        <tr>
                          <td>Penalizaciones</td>
                          <td>{selectedDetail.invoice.penalties.toFixed(2)} €</td>
                        </tr>
                      )}
                      {selectedDetail.invoice.discount > 0 && (
                        <tr>
                          <td>Descuento</td>
                          <td>− {selectedDetail.invoice.discount.toFixed(2)} €</td>
                        </tr>
                      )}
                      <tr className={styles.breakdownIva}>
                        <td>Base imponible</td>
                        <td>
                          {(
                            selectedDetail.invoice.baseAmount +
                            selectedDetail.invoice.extrasAmount +
                            selectedDetail.invoice.insuranceAmount +
                            selectedDetail.invoice.fuelAmount +
                            selectedDetail.invoice.penalties -
                            selectedDetail.invoice.discount
                          ).toFixed(2)} €
                        </td>
                      </tr>
                      <tr className={styles.breakdownIva}>
                        <td>IVA ({selectedDetail.invoice.ivaPercent}%)</td>
                        <td>{selectedDetail.invoice.ivaAmount.toFixed(2)} €</td>
                      </tr>
                      <tr className={styles.breakdownTotal}>
                        <td>TOTAL</td>
                        <td>{selectedDetail.invoice.total.toFixed(2)} €</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {finalizeError && (
                <div className="alert alert-danger" style={{ marginTop: 16 }}>{finalizeError}</div>
              )}
              {emailFeedback && (
                <div
                  className={emailFeedback.ok ? 'alert alert-success' : 'alert alert-danger'}
                  style={{ marginTop: 16 }}
                >
                  {emailFeedback.msg}
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setSelectedDetail(null)}>
                Cerrar
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const printUrl = `/api/facturas/${selectedDetail.invoice.id}/print`;
                  window.open(printUrl, '_blank');
                }}
                title="Exportar / imprimir factura"
              >
                Exportar PDF
              </button>
              {canWrite && (
                <button
                  className="btn btn-ghost"
                  onClick={() => void handleSendInvoiceEmail()}
                  disabled={sendingEmail || !selectedDetail.client?.email}
                  title={
                    selectedDetail.client?.email
                      ? `Enviar a ${selectedDetail.client.email}`
                      : 'El cliente no tiene email registrado'
                  }
                >
                  {sendingEmail ? 'Enviando…' : 'Enviar por email'}
                </button>
              )}
              {canWrite && selectedDetail.invoice.status === 'BORRADOR' && (
                <button
                  className="btn btn-primary"
                  onClick={handleFinalizar}
                  disabled={finalizingSaving}
                >
                  {finalizingSaving ? 'Procesando…' : 'Finalizar factura'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab wrapper ──────────────────────────────────────────────────────────

const FACTURACION_TABS = [
  { key: 'diario',      label: 'Diario de facturas' },
  { key: 'gastos',      label: 'Gastos internos' },
  { key: 'envios',      label: 'Log de envíos' },
  { key: 'estadisticas',label: 'Estadísticas' },
  { key: 'crear',       label: 'Crear factura' },
];

function FacturacionTabNav({ active }: { active: string }) {
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
      {FACTURACION_TABS.map((t) => (
        <button key={t.key} type="button" onClick={() => go(t.key)} style={{ flex: 1, textAlign: 'center', padding: '7px 8px', fontSize: '0.82rem', fontWeight: active === t.key ? 600 : 500, color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)', background: active === t.key ? 'var(--color-surface-strong)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function FacturacionInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'diario';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturación</h1>
          <p className="page-subtitle">{FACTURACION_TABS.find((t) => t.key === tab)?.label ?? tab}</p>
        </div>
        {tab === 'diario' && <PrintButton />}
      </div>
      <FacturacionTabNav active={tab} />
      {tab === 'diario' && <FacturacionContent />}
      {tab !== 'diario' && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-state__icon">🚧</div>
          <div className="empty-state__text">{FACTURACION_TABS.find((t) => t.key === tab)?.label ?? tab} — Próximamente</div>
        </div>
      )}
    </div>
  );
}

export default function FacturacionPage() {
  return (
    <Suspense>
      <FacturacionInner />
    </Suspense>
  );
}
