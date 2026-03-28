'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter as useNextRouter } from 'next/navigation';
import type {
  Contract,
  ContractStatus,
  Client,
  VehicleCategory,
  FleetVehicle,
  Reservation,
  CompanyBranch,
} from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import ContratoDetail from './ContratoDetail';
import GestionContratoTab from './GestionContratoTab';
import styles from './contratos.module.css';
import PrintButton from '@/src/components/PrintButton';

type StoreData = {
  clients: Client[];
  categories: VehicleCategory[];
  branches: CompanyBranch[];
  userRole: string;
};

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function calcPaid(contract: Contract): number {
  const paid = contract.payments
    .filter((p) => !p.isRefund)
    .reduce((s, p) => s + p.amount, 0);
  const refunded = contract.payments
    .filter((p) => p.isRefund)
    .reduce((s, p) => s + p.amount, 0);
  return paid - refunded;
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  ABIERTO: 'Abierto',
  CERRADO: 'Cerrado',
  CANCELADO: 'Cancelado',
};

const STATUS_BADGE: Record<ContractStatus, string> = {
  ABIERTO: 'badge-abierto',
  CERRADO: 'badge-cerrado',
  CANCELADO: 'badge-cancelada',
};

function ContratosContent() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [storeData, setStoreData] = useState<StoreData>({
    clients: [],
    categories: [],
    branches: [],
    userRole: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Detail modal
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterBranch) params.set('branchId', filterBranch);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      if (filterSearch) params.set('search', filterSearch);

      const res = await fetch(`/api/contratos?${params}`);
      if (!res.ok) throw new Error('Error al cargar contratos');
      const data = await res.json();
      setContracts(data.contracts ?? []);
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
          fetch('/api/clientes'),
          fetch('/api/categorias'),
          fetch('/api/sucursales'),
          fetch('/api/me'),
        ]);
        const clients = clientsRes.ok ? (await clientsRes.json()).clients ?? [] : [];
        const categories = categoriesRes.ok ? (await categoriesRes.json()).categories ?? [] : [];
        const branches = branchesRes.ok ? (await branchesRes.json()).branches ?? [] : [];
        const me = meRes.ok ? await meRes.json() : {};
        setStoreData({ clients, categories, branches, userRole: me.role ?? '' });
      } catch {
        // non-critical
      }
    }
    loadStoreData();
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  function handleContractUpdated(updated: Contract) {
    setContracts((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    setSelectedContract(updated);
  }

  function handleCloseDetail() {
    setSelectedContract(null);
    loadContracts();
  }

  const clientMap = Object.fromEntries(
    storeData.clients.map((c) => [
      c.id,
      `${c.name}${c.surname ? ' ' + c.surname : ''}`,
    ])
  );

  return (
    <div>
      {/* Filters */}
      <div className="filters-bar">
        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setHasSearched(true); }}
          style={{ width: 'auto' }}
        >
          <option value="">Todos los estados</option>
          <option value="ABIERTO">Abierto</option>
          <option value="CERRADO">Cerrado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        {storeData.branches.length > 1 && (
          <select
            className="form-select"
            value={filterBranch}
            onChange={(e) => { setFilterBranch(e.target.value); setHasSearched(true); }}
            style={{ width: 'auto' }}
          >
            <option value="">Todas las sucursales</option>
            {storeData.branches.map((b) => (
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
          placeholder="Buscar número, matrícula, cliente…"
          style={{ minWidth: 220 }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => { setHasSearched(true); loadContracts(); }}>
          Listar
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {contracts.length} contrato{contracts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
        ) : loading ? (
          <div className={styles.loadingRow}>Cargando contratos…</div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__text">
              No hay contratos que coincidan con los filtros. Los contratos se crean desde reservas confirmadas.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Vehículo</th>
                <th>Fechas</th>
                <th>Total</th>
                <th>Caja</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const netPaid = calcPaid(c);
                const isPaid = netPaid >= c.total;
                const cajaClass = isPaid ? styles.paid : styles.underpaid;
                return (
                  <tr key={c.id}>
                    <td>
                      <span className={styles.number}>{c.number}</span>
                    </td>
                    <td>{clientMap[c.clientId] ?? c.clientId}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.plate}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem' }}>
                      {formatDate(c.startDate)}<br />
                      <span style={{ color: 'var(--color-text-muted)' }}>{formatDate(c.endDate)}</span>
                    </td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {c.total.toFixed(2)} €
                    </td>
                    <td>
                      <span className={`${styles.cajaCell} ${cajaClass}`}>
                        {netPaid.toFixed(2)} / {c.total.toFixed(2)} €
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedContract(c)}
                          title="Ver detalle"
                        >
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {selectedContract && (
        <ContratoDetail
          contract={selectedContract}
          clients={storeData.clients}
          categories={storeData.categories}
          branches={storeData.branches}
          onClose={handleCloseDetail}
          onUpdated={handleContractUpdated}
        />
      )}
    </div>
  );
}

// ─── Asignación matrícula tab ─────────────────────────────────────────────────

type AsignItem =
  | { kind: 'contrato'; data: Contract }
  | { kind: 'reserva'; data: Reservation };

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function AsignacionMatriculaTab() {
  const [items, setItems] = useState<AsignItem[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Assign modal
  const [assignTarget, setAssignTarget] = useState<AsignItem | null>(null);
  const [selectedPlate, setSelectedPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Load support data on mount
  useEffect(() => {
    async function loadSupportData() {
      try {
        const [vehiclesRes, clientsRes, categoriesRes] = await Promise.all([
          fetch('/api/vehiculos/flota?active=true'),
          fetch('/api/clientes'),
          fetch('/api/categorias'),
        ]);
        if (vehiclesRes.ok) {
          const d = await vehiclesRes.json();
          setVehicles(d.vehicles ?? []);
        }
        if (clientsRes.ok) {
          const d = await clientsRes.json();
          setClients(d.clients ?? []);
        }
        if (categoriesRes.ok) {
          const d = await categoriesRes.json();
          setCategories(d.categories ?? []);
        }
      } catch {
        // non-critical
      }
    }
    loadSupportData();
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [contractsRes, reservationsRes] = await Promise.all([
        fetch('/api/contratos?status=ABIERTO'),
        fetch('/api/reservas?status=CONFIRMADA'),
      ]);

      const contractsData = contractsRes.ok ? await contractsRes.json() : { contracts: [] };
      const reservationsData = reservationsRes.ok ? await reservationsRes.json() : { reservations: [] };

      const contracts: Contract[] = contractsData.contracts ?? [];
      const reservations: Reservation[] = reservationsData.reservations ?? [];

      const contractItems: AsignItem[] = contracts
        .filter((c) => !c.plate)
        .map((c) => ({ kind: 'contrato', data: c }));

      const reservationItems: AsignItem[] = reservations
        .filter((r) => !r.assignedPlate && !r.contractId)
        .map((r) => ({ kind: 'reserva', data: r }));

      setItems([...contractItems, ...reservationItems]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch() {
    setHasSearched(true);
    loadItems();
  }

  const clientMap = Object.fromEntries(
    clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`])
  );
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  function getItemCategoryId(item: AsignItem): string {
    return item.kind === 'contrato' ? item.data.categoryId : item.data.categoryId;
  }

  function getItemClientId(item: AsignItem): string {
    return item.kind === 'contrato' ? item.data.clientId : item.data.clientId;
  }

  function getItemNumber(item: AsignItem): string {
    return item.kind === 'contrato' ? item.data.number : item.data.number;
  }

  function getItemStartDate(item: AsignItem): string {
    return item.kind === 'contrato' ? item.data.startDate : item.data.startDate;
  }

  function getItemEndDate(item: AsignItem): string {
    return item.kind === 'contrato' ? item.data.endDate : item.data.endDate;
  }

  function getItemPlate(item: AsignItem): string | undefined {
    return item.kind === 'contrato' ? (item.data.plate || undefined) : item.data.assignedPlate;
  }

  const filteredItems = items.filter((item) => {
    if (filterStartDate) {
      const startDate = getItemStartDate(item);
      if (startDate < filterStartDate) return false;
    }
    if (filterCategory) {
      if (getItemCategoryId(item) !== filterCategory) return false;
    }
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      const number = getItemNumber(item).toLowerCase();
      const clientName = (clientMap[getItemClientId(item)] ?? '').toLowerCase();
      if (!number.includes(search) && !clientName.includes(search)) return false;
    }
    return true;
  });

  function openAssignModal(item: AsignItem) {
    setAssignTarget(item);
    setSelectedPlate('');
    setSaveError('');
  }

  function closeAssignModal() {
    setAssignTarget(null);
    setSelectedPlate('');
    setSaveError('');
  }

  async function handleAssign() {
    if (!assignTarget || !selectedPlate) return;
    setSaving(true);
    setSaveError('');
    try {
      let res: Response;
      if (assignTarget.kind === 'contrato') {
        res = await fetch(`/api/contratos/${assignTarget.data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plate: selectedPlate }),
        });
      } else {
        res = await fetch(`/api/reservas/${assignTarget.data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedPlate: selectedPlate }),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Error al asignar matrícula');
      }
      closeAssignModal();
      loadItems();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  const modalCategoryId = assignTarget ? getItemCategoryId(assignTarget) : '';
  const availableVehicles = vehicles.filter(
    (v) => v.active && (!modalCategoryId || v.categoryId === modalCategoryId)
  );

  return (
    <div>
      {/* Filters */}
      <div className="filters-bar">
        <DatePicker
          className="form-input"
          value={filterStartDate}
          onChange={(v) => setFilterStartDate(v)}
          style={{ width: 'auto' }}
        />
        <select
          className="form-select"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <input
          type="search"
          className="form-input"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Buscar número, cliente…"
          style={{ minWidth: 200 }}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSearch}>
          Buscar
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setFilterStartDate(''); setFilterCategory(''); setFilterSearch(''); setHasSearched(false); setItems([]); }}
        >
          Limpiar
        </button>
        {hasSearched && (
          <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {filteredItems.length} pendiente{filteredItems.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>
            Aplica los filtros para ver asignaciones pendientes.
          </div>
        ) : loading ? (
          <div className={styles.loadingRow}>Cargando…</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__text">
              No hay contratos ni reservas con matrícula pendiente de asignar.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Número</th>
                <th>Cliente</th>
                <th>Categoría</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Días</th>
                <th>Vehículo asignado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const plate = getItemPlate(item);
                const startDate = getItemStartDate(item);
                const endDate = getItemEndDate(item);
                const days = calcDays(startDate, endDate);
                const id = item.kind === 'contrato' ? item.data.id : item.data.id;
                return (
                  <tr key={`${item.kind}-${id}`}>
                    <td>
                      <span className={`badge ${item.kind === 'contrato' ? 'badge-confirmada' : 'badge-peticion'}`}>
                        {item.kind === 'contrato' ? 'Contrato' : 'Reserva'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
                        {getItemNumber(item)}
                      </span>
                    </td>
                    <td>{clientMap[getItemClientId(item)] ?? getItemClientId(item)}</td>
                    <td>{categoryMap[getItemCategoryId(item)] ?? getItemCategoryId(item)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem' }}>{formatDate(startDate)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem' }}>{formatDate(endDate)}</td>
                    <td style={{ textAlign: 'center' }}>{days}</td>
                    <td>
                      {plate ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{plate}</span>
                      ) : (
                        <span style={{ color: 'var(--color-danger)', fontSize: '0.82rem', fontWeight: 500 }}>Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openAssignModal(item)}
                      >
                        Asignar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign modal */}
      {assignTarget && (
        <div className="modal-overlay" onClick={closeAssignModal}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                Asignar matrícula — {getItemNumber(assignTarget)}
              </h3>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  Categoría: <strong>{categoryMap[getItemCategoryId(assignTarget)] ?? getItemCategoryId(assignTarget)}</strong>
                </label>
                <select
                  className="form-select"
                  value={selectedPlate}
                  onChange={(e) => setSelectedPlate(e.target.value)}
                  style={{ width: '100%' }}
                  autoFocus
                >
                  <option value="">— Selecciona un vehículo —</option>
                  {availableVehicles.length === 0 && (
                    <option value="" disabled>No hay vehículos activos en esta categoría</option>
                  )}
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.plate}>
                      {v.plate}{v.color ? ` — ${v.color}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {saveError && (
                <div className="alert alert-danger" style={{ margin: 0 }}>{saveError}</div>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost btn-sm" onClick={closeAssignModal} disabled={saving}>
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAssign}
                disabled={saving || !selectedPlate}
              >
                {saving ? 'Guardando…' : 'Confirmar asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Histórico Tab ────────────────────────────────────────────────────────────

function HistoricoTab() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [filterStatus, setFilterStatus] = useState('CERRADO');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [selected, setSelected] = useState<Contract | null>(null);

  useEffect(() => {
    Promise.all([fetch('/api/clientes'), fetch('/api/sucursales')])
      .then(async ([cRes, bRes]) => {
        if (cRes.ok) setClients((await cRes.json()).clients ?? []);
        if (bRes.ok) setBranches((await bRes.json()).branches ?? []);
      }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterBranch) params.set('branchId', filterBranch);
      if (filterFrom) params.set('dateFrom', filterFrom);
      if (filterTo) params.set('dateTo', filterTo);
      if (filterSearch) params.set('search', filterSearch);
      const res = await fetch(`/api/contratos?${params}`);
      if (!res.ok) throw new Error('Error al cargar');
      setContracts((await res.json()).contracts ?? []);
      setHasSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setLoading(false); }
  }, [filterStatus, filterBranch, filterFrom, filterTo, filterSearch]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const totalRevenue = contracts.reduce((s, c) => s + c.total, 0);
  const totalDays = contracts.reduce((s, c) => s + c.billedDays, 0);

  return (
    <div>
      <div className="filters-bar">
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todos los estados</option>
          <option value="CERRADO">Cerrado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <select className="form-select" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <DatePicker className="form-input" value={filterFrom} onChange={setFilterFrom} style={{ width: 'auto' }} />
        <DatePicker className="form-input" value={filterTo} onChange={setFilterTo} style={{ width: 'auto' }} />
        <input className="form-input" placeholder="Número, matrícula, cliente…" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} style={{ minWidth: 180 }} />
        <button className="btn btn-primary btn-sm" onClick={() => void load()}>Listar</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {hasSearched && !loading && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Contratos', value: String(contracts.length) },
            { label: 'Importe total', value: `${totalRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` },
            { label: 'Días facturados', value: String(totalDays) },
            { label: 'Ticket medio', value: contracts.length > 0 ? `${(totalRevenue / contracts.length).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—' },
          ].map((card) => (
            <div key={card.label} style={{ flex: '1 1 130px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="table-wrapper">
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el historial.</div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
        ) : contracts.length === 0 ? (
          <div className="empty-state"><div className="empty-state__text">No hay contratos con los filtros seleccionados.</div></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Matrícula</th>
                <th>Salida</th>
                <th>Retorno</th>
                <th style={{ textAlign: 'right' }}>Días</th>
                <th style={{ textAlign: 'right' }}>Importe</th>
                <th>Estado</th>
                <th>Sucursal</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const client = clientMap[c.clientId];
                const clientName = client ? (client.type === 'EMPRESA' ? (client.companyName ?? client.name) : client.name) : '—';
                const badge = c.status === 'CERRADO' ? 'badge-cerrado' : 'badge-cancelada';
                const label = c.status === 'CERRADO' ? 'Cerrado' : 'Cancelado';
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                    <td><strong>{c.number}</strong></td>
                    <td style={{ fontSize: '0.85rem' }}>{clientName}</td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.plate}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(c.startDate)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(c.endDate)}</td>
                    <td style={{ textAlign: 'right' }}>{c.billedDays}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td><span className={`badge ${badge}`}>{label}</span></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{branchMap[c.branchId] ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal__header">
              <span className="modal__title">Contrato {selected.number}</span>
              <button className="modal__close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: '0.85rem' }}>
                {[
                  ['Número', selected.number],
                  ['Matrícula', selected.plate],
                  ['Cliente', clientMap[selected.clientId]?.name ?? '—'],
                  ['Estado', selected.status],
                  ['Salida', `${formatDate(selected.startDate)} ${selected.startTime}`],
                  ['Retorno', `${formatDate(selected.endDate)} ${selected.endTime}`],
                  ['Días facturados', String(selected.billedDays)],
                  ['Importe total', `${selected.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`],
                  ['Sucursal', branchMap[selected.branchId] ?? '—'],
                  ['Factura', selected.invoiceId ?? 'Sin factura'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cambio de vehículo Tab ───────────────────────────────────────────────────

function CambioVehiculoTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [contract, setContract] = useState<Contract | null>(null);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [newPlate, setNewPlate] = useState('');
  const [reason, setReason] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/vehiculos/flota?active=true'), fetch('/api/vehiculos/categorias')])
      .then(async ([vRes, cRes]) => {
        if (vRes.ok) setVehicles((await vRes.json()).vehicles ?? []);
        if (cRes.ok) setCategories((await cRes.json()).categories ?? []);
      }).catch(() => {});
  }, []);

  async function search() {
    if (!searchTerm.trim()) return;
    setSearching(true); setError(''); setContract(null); setSuccess('');
    try {
      const res = await fetch(`/api/contratos?search=${encodeURIComponent(searchTerm)}&status=ABIERTO`);
      if (!res.ok) throw new Error('Error al buscar');
      const list: Contract[] = (await res.json()).contracts ?? [];
      const found = list[0];
      if (!found) throw new Error('No se encontró ningún contrato abierto con ese criterio');
      setContract(found);
      setNewPlate('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setSearching(false); }
  }

  async function apply() {
    if (!contract || !newPlate) return;
    setSaving(true); setError('');
    try {
      const body: Record<string, string> = { plate: newPlate };
      if (reason.trim()) body.internalNotes = `[CAMBIO VEHÍCULO] ${reason}`;
      const res = await fetch(`/api/contratos/${contract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al cambiar vehículo');
      setSuccess(`Vehículo cambiado: ${contract.plate} → ${newPlate} en contrato ${contract.number}`);
      setContract(null); setSearchTerm(''); setNewPlate(''); setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setSaving(false); }
  }

  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const compatible = contract ? vehicles.filter((v) => v.categoryId === contract.categoryId && v.plate !== contract.plate) : [];

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>
        Reasigna la matrícula de un contrato abierto a otro vehículo disponible. La operación queda registrada en auditoría.
      </p>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 12 }}>1 — Localizar contrato abierto</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
            placeholder="Número de contrato o matrícula actual"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => void search()} disabled={searching}>
            {searching ? '…' : 'Buscar'}
          </button>
        </div>
        {error && !contract && <div className="alert alert-danger" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {contract && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 12 }}>2 — Seleccionar nuevo vehículo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: '0.85rem', marginBottom: 14 }}>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Contrato: </span><strong>{contract.number}</strong></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Matrícula actual: </span><strong style={{ fontFamily: 'monospace' }}>{contract.plate}</strong></div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Grupo: </span>{getCatName(contract.categoryId)}</div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>Período: </span>{formatDate(contract.startDate)} — {formatDate(contract.endDate)}</div>
          </div>

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Nueva matrícula *</label>
            <select className="form-select" value={newPlate} onChange={(e) => setNewPlate(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {compatible.map((v) => <option key={v.id} value={v.plate}>{v.plate}</option>)}
            </select>
            {compatible.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>No hay otros vehículos activos en el mismo grupo.</div>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Motivo (recomendado)</label>
            <input className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Avería, solicitud del cliente…" />
          </div>
          {error && <div className="alert alert-danger" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {contract && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setContract(null); setSearchTerm(''); setError(''); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => void apply()} disabled={saving || !newPlate}>
            {saving ? 'Aplicando…' : 'Confirmar cambio'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Renumerar Tab ────────────────────────────────────────────────────────────

function RenumerarTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [contract, setContract] = useState<Contract | null>(null);
  const [newNumber, setNewNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function search() {
    if (!searchTerm.trim()) return;
    setSearching(true); setError(''); setContract(null); setSuccess('');
    try {
      const res = await fetch(`/api/contratos?search=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error('Error al buscar');
      const list: Contract[] = (await res.json()).contracts ?? [];
      const found = list[0];
      if (!found) throw new Error('No se encontró ningún contrato con ese criterio');
      setContract(found);
      setNewNumber(found.number);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setSearching(false); }
  }

  async function apply() {
    if (!contract || !newNumber.trim() || newNumber === contract.number) return;
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/contratos/${contract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: newNumber.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al renumerar');
      setSuccess(`Contrato renumerado: ${contract.number} → ${newNumber}`);
      setContract(null); setSearchTerm(''); setNewNumber('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: 20 }}>
        Cambia el número de un contrato existente. Úsalo solo en caso de error de numeración. La acción queda registrada.
      </p>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 12 }}>Buscar contrato</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
            placeholder="Número de contrato o matrícula"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => void search()} disabled={searching}>
            {searching ? '…' : 'Buscar'}
          </button>
        </div>
        {error && !contract && <div className="alert alert-danger" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {contract && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: '0.85rem', marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Contrato encontrado: <strong style={{ color: 'var(--color-text-primary)' }}>{contract.number}</strong>
            {' '}· {contract.plate} · {formatDate(contract.startDate)} · <span className={`badge ${contract.status === 'ABIERTO' ? 'badge-abierto' : contract.status === 'CERRADO' ? 'badge-cerrado' : 'badge-cancelada'}`} style={{ fontSize: '0.75rem' }}>{contract.status}</span>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nuevo número *</label>
            <input
              className="form-input"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="Nuevo número de contrato"
            />
          </div>
          {error && <div className="alert alert-danger" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {contract && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setContract(null); setSearchTerm(''); setError(''); }}>Cancelar</button>
          <button className="btn btn-danger" onClick={() => void apply()} disabled={saving || !newNumber.trim() || newNumber === contract.number}>
            {saving ? 'Guardando…' : 'Renumerar'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Informes Tab (Contratos) ─────────────────────────────────────────────────

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function InformesContratoTab() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [filterBranch, setFilterBranch] = useState('');

  useEffect(() => {
    fetch('/api/sucursales').then(async (r) => { if (r.ok) setBranches((await r.json()).branches ?? []); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ status: 'CERRADO', dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` });
      if (filterBranch) params.set('branchId', filterBranch);
      const res = await fetch(`/api/contratos?${params}`);
      if (!res.ok) throw new Error('Error al cargar');
      setContracts((await res.json()).contracts ?? []);
      setHasSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setLoading(false); }
  }, [year, filterBranch]);

  const monthly = MESES.map((label, i) => {
    const mc = contracts.filter((c) => new Date(c.startDate).getMonth() === i);
    return { label, count: mc.length, days: mc.reduce((s, c) => s + c.billedDays, 0), revenue: mc.reduce((s, c) => s + c.total, 0) };
  });
  const totals = { count: contracts.length, days: contracts.reduce((s, c) => s + c.billedDays, 0), revenue: contracts.reduce((s, c) => s + c.total, 0) };
  const maxRev = Math.max(...monthly.map((m) => m.revenue), 1);

  return (
    <div>
      <div className="filters-bar">
        <input type="number" className="form-input" value={year} min={2020} max={2100} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 90 }} />
        <select className="form-select" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => void load()}>Listar</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>}

      {hasSearched && !loading && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Contratos cerrados', value: String(totals.count) },
              { label: 'Días facturados', value: String(totals.days) },
              { label: 'Ingresos', value: `${totals.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` },
              { label: 'Ticket medio', value: totals.count > 0 ? `${(totals.revenue / totals.count).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—' },
            ].map((card) => (
              <div key={card.label} style={{ flex: '1 1 130px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{card.label}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'right' }}>Contratos</th>
                  <th style={{ textAlign: 'right' }}>Días</th>
                  <th style={{ textAlign: 'right' }}>Ingresos</th>
                  <th>Distribución</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((row) => (
                  <tr key={row.label}>
                    <td style={{ fontWeight: 500 }}>{row.label}</td>
                    <td style={{ textAlign: 'right', color: row.count === 0 ? 'var(--color-text-muted)' : undefined }}>{row.count || '—'}</td>
                    <td style={{ textAlign: 'right', color: row.days === 0 ? 'var(--color-text-muted)' : undefined }}>{row.days || '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.revenue === 0 ? 'var(--color-text-muted)' : undefined }}>
                      {row.revenue > 0 ? `${row.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(row.revenue / maxRev) * 100}%`, background: 'var(--color-primary)', borderRadius: 3 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>TOTAL {year}</td>
                  <td style={{ textAlign: 'right' }}>{totals.count}</td>
                  <td style={{ textAlign: 'right' }}>{totals.days}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{totals.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-tab wrapper ──────────────────────────────────────────────────────────

const CONTRATOS_TABS = [
  { key: 'gestion',   label: 'Gestión de contrato' },
  { key: 'listado',   label: 'Localizar contrato' },
  { key: 'matricula', label: 'Asignación matrícula' },
  { key: 'cambio',    label: 'Cambio de vehículo' },
  { key: 'renumerar', label: 'Renumerar' },
  { key: 'historico', label: 'Histórico' },
  { key: 'informes',  label: 'Informes' },
];

function ContratosTabNav({ active }: { active: string }) {
  const router = useNextRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 24 }}>
      {CONTRATOS_TABS.map((t) => (
        <button key={t.key} type="button" onClick={() => go(t.key)} style={{ flex: 1, textAlign: 'center', padding: '7px 8px', fontSize: '0.82rem', fontWeight: active === t.key ? 600 : 500, color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)', background: active === t.key ? 'var(--color-surface-strong)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function ContratosInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'gestion';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contratos</h1>
          <p className="page-subtitle">{CONTRATOS_TABS.find((t) => t.key === tab)?.label ?? tab}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            className="btn btn-ghost btn-sm"
            href="/api/contratos/blank?lang=es"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            Contrato en blanco (ES)
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href="/api/contratos/blank?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            Blank contract (EN)
          </a>
          {tab === 'gestion' && <PrintButton label="Imprimir contrato" />}
          {tab === 'listado' && <PrintButton />}
        </div>
      </div>
      <ContratosTabNav active={tab} />
      {tab === 'gestion'   && <GestionContratoTab />}
      {tab === 'listado'   && <ContratosContent />}
      {tab === 'matricula' && <AsignacionMatriculaTab />}
      {tab === 'cambio'    && <CambioVehiculoTab />}
      {tab === 'renumerar' && <RenumerarTab />}
      {tab === 'historico' && <HistoricoTab />}
      {tab === 'informes'  && <InformesContratoTab />}
    </div>
  );
}

export default function ContratosPage() {
  return (
    <Suspense>
      <ContratosInner />
    </Suspense>
  );
}
