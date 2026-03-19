'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  Contract,
  ContractStatus,
  Client,
  VehicleCategory,
  CompanyBranch,
} from '@/src/lib/types';
import ContratoDetail from './ContratoDetail';
import styles from './contratos.module.css';

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

export default function ContratosPage() {
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Contratos</h1>
          <p className="page-subtitle">
            {contracts.length} contrato{contracts.length !== 1 ? 's' : ''} encontrado{contracts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="form-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
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
            onChange={(e) => setFilterBranch(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">Todas las sucursales</option>
            {storeData.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <input
          type="date"
          className="form-input"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          style={{ width: 'auto' }}
          title="Fecha inicio desde"
        />
        <input
          type="date"
          className="form-input"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          style={{ width: 'auto' }}
          title="Fecha inicio hasta"
        />
        <input
          type="search"
          className="form-input"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Buscar número, matrícula, cliente…"
          style={{ minWidth: 220 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={loadContracts}>
          Actualizar
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
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
