'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Reservation, Client, VehicleCategory, CompanyBranch, ReservationStatus } from '@/src/lib/types';
import ReservaForm from './ReservaForm';
import styles from './reservas.module.css';

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
  const map: Record<ReservationStatus, string> = {
    PETICION: 'Petición',
    CONFIRMADA: 'Confirmada',
    CANCELADA: 'Cancelada',
  };
  return map[r.status] ?? r.status;
}

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function ReservasPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
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

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

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
    // Load store data (clients, categories, branches) and user info
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
    loadReservations();
  }, [loadReservations]);

  async function handleConfirm(id: string) {
    const res = await fetch(`/api/reservas/${id}/confirmar`, { method: 'POST' });
    if (res.ok) {
      loadReservations();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Error al confirmar');
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    const res = await fetch(`/api/reservas/${id}/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Cancelada manualmente' }),
    });
    if (res.ok) {
      loadReservations();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Error al cancelar');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta reserva? Esta acción no se puede deshacer.')) return;
    const res = await fetch(`/api/reservas/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadReservations();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Error al eliminar');
    }
  }

  function handleEdit(r: Reservation) {
    setEditingReservation(r);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingReservation(null);
  }

  function handleFormSaved() {
    setShowForm(false);
    setEditingReservation(null);
    loadReservations();
  }

  async function handleConvertir(id: string) {
    if (!confirm('¿Convertir esta reserva a contrato? Se creará un contrato vinculado.')) return;
    const res = await fetch(`/api/reservas/${id}/convertir`, { method: 'POST' });
    if (res.ok) {
      router.push('/contratos');
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Error al convertir la reserva');
    }
  }

  const canWrite = storeData.userRole !== 'LECTOR';

  const clientMap = Object.fromEntries(storeData.clients.map((c) => [c.id, c]));
  const categoryMap = Object.fromEntries(storeData.categories.map((c) => [c.id, c]));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">{reservations.length} reserva{reservations.length !== 1 ? 's' : ''} encontrada{reservations.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <button
            className="btn btn-primary"
            onClick={() => { setEditingReservation(null); setShowForm(true); }}
          >
            + Nueva Reserva
          </button>
        )}
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
          <option value="PETICION">Petición</option>
          <option value="CONFIRMADA">Confirmada</option>
          <option value="CANCELADA">Cancelada</option>
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
          placeholder="Desde"
          title="Fecha desde"
        />
        <input
          type="date"
          className="form-input"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          style={{ width: 'auto' }}
          placeholder="Hasta"
          title="Fecha hasta"
        />
        <input
          type="search"
          className="form-input"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          placeholder="Buscar número, matrícula…"
          style={{ minWidth: 200 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={loadReservations}>
          Actualizar
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className={styles.loadingRow}>Cargando reservas…</div>
        ) : reservations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__text">No hay reservas que coincidan con los filtros</div>
            {canWrite && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => { setEditingReservation(null); setShowForm(true); }}
              >
                Crear primera reserva
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Categoría</th>
                <th>Matrícula</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const client = clientMap[r.clientId];
                const category = categoryMap[r.categoryId];
                const badge = statusBadge(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <span className={styles.number}>{r.number}</span>
                    </td>
                    <td>
                      {client
                        ? `${client.name}${client.surname ? ' ' + client.surname : ''}`
                        : <span className="text-muted">{r.clientId}</span>
                      }
                    </td>
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
                    <td style={{ fontWeight: 600 }}>
                      {r.total.toFixed(2)} €
                    </td>
                    <td>
                      <span className={`badge badge-${badge}`}>
                        {statusLabel(r)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {canWrite && r.status === 'PETICION' && !r.contractId && (
                          <button
                            className="btn btn-accent btn-sm"
                            onClick={() => handleConfirm(r.id)}
                            title="Confirmar reserva"
                          >
                            Confirmar
                          </button>
                        )}
                        {canWrite && r.status === 'CONFIRMADA' && !r.contractId && r.assignedPlate && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleConvertir(r.id)}
                            title="Convertir a contrato"
                          >
                            Convertir
                          </button>
                        )}
                        {canWrite && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleEdit(r)}
                            title="Editar"
                          >
                            Editar
                          </button>
                        )}
                        {canWrite && !r.contractId && r.status !== 'CANCELADA' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleCancel(r.id)}
                            title="Cancelar"
                          >
                            Cancelar
                          </button>
                        )}
                        {canWrite && !r.contractId && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(r.id)}
                            title="Eliminar"
                          >
                            Eliminar
                          </button>
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

      {/* Form modal */}
      {showForm && (
        <ReservaForm
          reservation={editingReservation}
          clients={storeData.clients}
          categories={storeData.categories}
          branches={storeData.branches}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}
