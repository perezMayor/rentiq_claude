'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Reservation, Client, VehicleCategory, CompanyBranch, ReservationStatus, Contract } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import ReservaForm from './ReservaForm';
import GestionReservaTab from './GestionReservaTab';
import styles from './reservas.module.css';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-tab nav ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'gestion',       label: 'Gestión de reserva' },
  { key: 'entregas',      label: 'Entregas' },
  { key: 'recogidas',     label: 'Recogidas' },
  { key: 'listado',       label: 'Localizar reserva' },
  { key: 'canales',       label: 'Canales' },
  { key: 'log',           label: 'Log confirmaciones' },
  { key: 'planning',      label: 'Planning' },
  { key: 'informes',      label: 'Informes de reserva' },
  { key: 'presupuesto',   label: 'Presupuestos' },
];

function TabNav({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <nav className={styles.subtabs}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`${styles.subtab} ${active === t.key ? styles.subtabActive : ''}`}
          onClick={() => go(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// ─── Entregas sub-tab ─────────────────────────────────────────────────────────

function EntregasTab() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/clientes'), fetch('/api/sucursales')]).then(async ([cr, br]) => {
      if (cr.ok) setClients((await cr.json()).clients ?? []);
      if (br.ok) setBranches((await br.json()).branches ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ status: 'ABIERTO', from: selectedDate, to: selectedDate });
        const res = await fetch(`/api/contratos?${params}`);
        if (!res.ok) throw new Error('Error al cargar contratos');
        const data = await res.json();
        setContracts((data.contracts ?? []).filter(
          (c: Contract) => c.startDate === selectedDate && !c.checkout
        ));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedDate]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`]));
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  return (
    <div>
      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <DatePicker className="form-input" value={selectedDate} onChange={(v) => setSelectedDate(v)} style={{ width: 'auto' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          {contracts.length} entrega{contracts.length !== 1 ? 's' : ''}
        </span>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🚗</div>
            <div className="empty-state__text">No hay entregas pendientes para esta fecha.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contrato</th><th>Cliente</th><th>Vehículo</th>
                <th>Hora salida</th><th>Lugar entrega</th><th>Retorno</th><th>Sucursal</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{c.number}</td>
                  <td>{clientMap[c.clientId] ?? c.clientId}</td>
                  <td><strong style={{ fontFamily: 'monospace' }}>{c.plate}</strong></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.startTime}</td>
                  <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>{c.pickupLocation}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatDate(c.endDate)} {c.endTime}</td>
                  <td>{branchMap[c.branchId] ?? c.branchId}</td>
                  <td>
                    {c.checkout
                      ? <span className="badge badge-cerrado">Checkout ✓</span>
                      : <span className="badge badge-peticion">Pendiente</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="alert alert-info" style={{ marginTop: 16 }}>
        El checkout se registra desde <strong>Contratos</strong>, abriendo el detalle del contrato.
      </div>
    </div>
  );
}

// ─── Recogidas sub-tab ────────────────────────────────────────────────────────

function RecogidasTab() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/clientes'), fetch('/api/sucursales')]).then(async ([cr, br]) => {
      if (cr.ok) setClients((await cr.json()).clients ?? []);
      if (br.ok) setBranches((await br.json()).branches ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ status: 'ABIERTO', to: selectedDate });
        const res = await fetch(`/api/contratos?${params}`);
        if (!res.ok) throw new Error('Error al cargar contratos');
        const data = await res.json();
        setContracts((data.contracts ?? []).filter(
          (c: Contract) => c.endDate <= selectedDate && c.checkout && !c.checkin
        ));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedDate]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`]));
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const today = todayStr();

  return (
    <div>
      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <DatePicker className="form-input" value={selectedDate} onChange={(v) => setSelectedDate(v)} style={{ width: 'auto' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          {contracts.length} recogida{contracts.length !== 1 ? 's' : ''}
        </span>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔑</div>
            <div className="empty-state__text">No hay recogidas pendientes hasta esta fecha.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contrato</th><th>Cliente</th><th>Vehículo</th>
                <th>Vencimiento</th><th>Lugar recogida</th><th>Sucursal</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const isOverdue = c.endDate < today;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{c.number}</td>
                    <td>{clientMap[c.clientId] ?? c.clientId}</td>
                    <td><strong style={{ fontFamily: 'monospace' }}>{c.plate}</strong></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={isOverdue ? { color: 'var(--color-danger)', fontWeight: 600 } : {}}>
                        {formatDate(c.endDate)} {c.endTime}
                      </span>
                      {isOverdue && (
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', background: 'rgba(180,35,24,0.12)', color: 'var(--color-danger)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                          VENCIDO
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>{c.returnLocation}</td>
                    <td>{branchMap[c.branchId] ?? c.branchId}</td>
                    <td>
                      {c.checkin
                        ? <span className="badge badge-cerrado">Checkin ✓</span>
                        : <span className="badge badge-peticion">Pendiente</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="alert alert-info" style={{ marginTop: 16 }}>
        El checkin se registra desde <strong>Contratos</strong>, abriendo el detalle del contrato.
      </div>
    </div>
  );
}

// ─── Placeholder tab ──────────────────────────────────────────────────────────

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="empty-state" style={{ marginTop: 32 }}>
      <div className="empty-state__icon">🚧</div>
      <div className="empty-state__text">{label} — Próximamente</div>
    </div>
  );
}

// ─── Reservation list tab ─────────────────────────────────────────────────────

type StoreData = {
  clients: Client[];
  categories: VehicleCategory[];
  branches: CompanyBranch[];
  userRole: string;
};

function statusBadge(r: Reservation): string {
  if (r.contractId) return 'contratado';
  return r.status.toLowerCase();
}

function statusLabel(r: Reservation): string {
  if (r.contractId) return 'Contratada';
  const map: Record<ReservationStatus, string> = { PETICION: 'Petición', CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada' };
  return map[r.status] ?? r.status;
}

function ListadoTab() {
  const router = useRouter();
  const pathname = usePathname();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [storeData, setStoreData] = useState<StoreData>({ clients: [], categories: [], branches: [], userRole: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterBranch) params.set('branchId', filterBranch);
      if (filterFrom) params.set('startFrom', filterFrom);
      if (filterTo) params.set('startTo', filterTo);
      if (filterSearch) params.set('search', filterSearch);
      const res = await fetch(`/api/reservas?${params}`);
      if (!res.ok) throw new Error('Error al cargar reservas');
      const data = await res.json();
      setReservations(data.reservations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterBranch, filterFrom, filterTo, filterSearch]);

  useEffect(() => {
    async function loadStoreData() {
      try {
        const [clientsRes, categoriesRes, branchesRes, meRes] = await Promise.all([
          fetch('/api/clientes'), fetch('/api/categorias'), fetch('/api/sucursales'), fetch('/api/me'),
        ]);
        const clients = clientsRes.ok ? (await clientsRes.json()).clients ?? [] : [];
        const categories = categoriesRes.ok ? (await categoriesRes.json()).categories ?? [] : [];
        const branches = branchesRes.ok ? (await branchesRes.json()).branches ?? [] : [];
        const me = meRes.ok ? await meRes.json() : {};
        setStoreData({ clients, categories, branches, userRole: me.role ?? '' });
      } catch { /* non-critical */ }
    }
    loadStoreData();
  }, []);

  useEffect(() => { loadReservations(); }, [loadReservations]);

  async function handleConfirm(id: string) {
    const res = await fetch(`/api/reservas/${id}/confirmar`, { method: 'POST' });
    if (res.ok) loadReservations();
    else { const data = await res.json().catch(() => ({})); alert(data.error ?? 'Error al confirmar'); }
  }

  async function handleCancel(id: string) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    const res = await fetch(`/api/reservas/${id}/cancelar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Cancelada manualmente' }) });
    if (res.ok) loadReservations();
    else { const data = await res.json().catch(() => ({})); alert(data.error ?? 'Error al cancelar'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta reserva? Esta acción no se puede deshacer.')) return;
    const res = await fetch(`/api/reservas/${id}`, { method: 'DELETE' });
    if (res.ok) loadReservations();
    else { const data = await res.json().catch(() => ({})); alert(data.error ?? 'Error al eliminar'); }
  }

  async function handleConvertir(id: string) {
    if (!confirm('¿Convertir esta reserva a contrato?')) return;
    const res = await fetch(`/api/reservas/${id}/convertir`, { method: 'POST' });
    if (res.ok) router.push('/contratos');
    else { const data = await res.json().catch(() => ({})); alert(data.error ?? 'Error al convertir'); }
  }

  const canWrite = storeData.userRole !== 'LECTOR';
  const clientMap = Object.fromEntries(storeData.clients.map((c) => [c.id, c]));
  const categoryMap = Object.fromEntries(storeData.categories.map((c) => [c.id, c]));

  return (
    <div>
      <div className="filters-bar">
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todos los estados</option>
          <option value="PETICION">Petición</option>
          <option value="CONFIRMADA">Confirmada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        {storeData.branches.length > 1 && (
          <select className="form-select" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Todas las sucursales</option>
            {storeData.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <DatePicker className="form-input" value={filterFrom} onChange={(v) => setFilterFrom(v)} style={{ width: 'auto' }} />
        <DatePicker className="form-input" value={filterTo} onChange={(v) => setFilterTo(v)} style={{ width: 'auto' }} />
        <input type="search" className="form-input" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Buscar número, matrícula…" style={{ minWidth: 200 }} />
        <button className="btn btn-ghost btn-sm" onClick={loadReservations}>Actualizar</button>
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {reservations.length} reserva{reservations.length !== 1 ? 's' : ''}
        </span>
        {canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => router.push(`${pathname}?tab=gestion`)}>
            + Nueva Reserva
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        {loading ? (
          <div className={styles.loadingRow}>Cargando reservas…</div>
        ) : reservations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__text">No hay reservas que coincidan con los filtros</div>
            {canWrite && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.push(`${pathname}?tab=gestion`)}>
                Crear primera reserva
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th><th>Cliente</th><th>Categoría</th><th>Matrícula</th>
                <th>Entrada</th><th>Salida</th><th>Total</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const client = clientMap[r.clientId];
                const category = categoryMap[r.categoryId];
                const badge = statusBadge(r);
                return (
                  <tr key={r.id}>
                    <td><span className={styles.number}>{r.number}</span></td>
                    <td>{client ? `${client.name}${client.surname ? ' ' + client.surname : ''}` : <span className="text-muted">{r.clientId}</span>}</td>
                    <td>{category?.name ?? r.categoryId}</td>
                    <td>{r.assignedPlate ?? <span className="text-muted">—</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(r.startDate)}<br />
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{r.startTime}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(r.endDate)}<br />
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{r.endTime}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.total.toFixed(2)} €</td>
                    <td><span className={`badge badge-${badge}`}>{statusLabel(r)}</span></td>
                    <td>
                      <div className={styles.actions}>
                        {canWrite && r.status === 'PETICION' && !r.contractId && (
                          <button className="btn btn-accent btn-sm" onClick={() => handleConfirm(r.id)}>Confirmar</button>
                        )}
                        {canWrite && r.status === 'CONFIRMADA' && !r.contractId && r.assignedPlate && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleConvertir(r.id)}>Convertir</button>
                        )}
                        {canWrite && (
                          <button className="btn btn-ghost btn-sm" onClick={() => router.push(`${pathname}?tab=gestion&id=${r.id}`)}>Editar</button>
                        )}
                        {canWrite && !r.contractId && r.status !== 'CANCELADA' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(r.id)}>Cancelar</button>
                        )}
                        {canWrite && !r.contractId && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Eliminar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ReservasPageInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'gestion';
  const reservationId = searchParams.get('id') ?? undefined;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">{TABS.find((t) => t.key === tab)?.label ?? tab}</p>
        </div>
      </div>
      <TabNav active={tab} />
      {tab === 'gestion'     && <GestionReservaTab reservationId={reservationId} />}
      {tab === 'entregas'    && <EntregasTab />}
      {tab === 'recogidas'   && <RecogidasTab />}
      {tab === 'listado'     && <ListadoTab autoOpenNew={false} />}
      {tab === 'canales'     && <PlaceholderTab label="Canales de venta" />}
      {tab === 'log'         && <PlaceholderTab label="Log de confirmaciones" />}
      {tab === 'planning'    && <PlaceholderTab label="Planning de reservas" />}
      {tab === 'informes'    && <PlaceholderTab label="Informes de reservas" />}
      {tab === 'presupuesto' && <PlaceholderTab label="Presupuestos" />}
    </div>
  );
}

export default function ReservasPage() {
  return (
    <Suspense>
      <ReservasPageInner />
    </Suspense>
  );
}
