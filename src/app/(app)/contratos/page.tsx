'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter as useNextRouter } from 'next/navigation';
import type {
  Contract,
  ContractStatus,
  Client,
  VehicleCategory,
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
        <DatePicker
          className="form-input"
          value={filterFrom}
          onChange={(v) => setFilterFrom(v)}
          style={{ width: 'auto' }}
        />
        <DatePicker
          className="form-input"
          value={filterTo}
          onChange={(v) => setFilterTo(v)}
          style={{ width: 'auto' }}
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
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {contracts.length} contrato{contracts.length !== 1 ? 's' : ''}
        </span>
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
        <PrintButton />
      </div>
      <ContratosTabNav active={tab} />
      {tab === 'gestion' && <GestionContratoTab />}
      {tab === 'listado' && <ContratosContent />}
      {tab !== 'gestion' && tab !== 'listado' && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-state__icon">🚧</div>
          <div className="empty-state__text">{CONTRATOS_TABS.find((t) => t.key === tab)?.label ?? tab} — Próximamente</div>
        </div>
      )}
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
