'use client';

import { useState, useEffect } from 'react';
import type { Contract, Client, CompanyBranch } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function RecogidasPage() {
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
        // Fetch ABIERTO contracts up to (and including) the selected date
        const params = new URLSearchParams({ status: 'ABIERTO', to: selectedDate });
        const res = await fetch(`/api/contratos?${params}`);
        if (!res.ok) throw new Error('Error al cargar contratos');
        const data = await res.json();
        // Recogidas = ABIERTO contracts ending on the selected date (with checkout but no checkin)
        // Also show those ending before today that haven't been returned yet (overdue)
        const recogidas = (data.contracts ?? []).filter(
          (c: Contract) => c.endDate <= selectedDate && c.checkout && !c.checkin
        );
        setContracts(recogidas);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedDate]);

  const clientMap = Object.fromEntries(
    clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`])
  );
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  const today = todayStr();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recogidas</h1>
          <p className="page-subtitle">
            {contracts.length} recogida{contracts.length !== 1 ? 's' : ''} pendiente{contracts.length !== 1 ? 's' : ''} · hasta {formatDate(selectedDate)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <DatePicker
            className="form-input"
            value={selectedDate}
            onChange={(v) => setSelectedDate(v)}
            style={{ width: 'auto' }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(todayStr())}>
            Hoy
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Cargando…
          </div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔑</div>
            <div className="empty-state__text">
              No hay recogidas pendientes hasta esta fecha.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Cliente</th>
                <th>Vehículo</th>
                <th>Vencimiento</th>
                <th>Lugar recogida</th>
                <th>Sucursal</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const isOverdue = c.endDate < today;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{c.number}</td>
                    <td>{clientMap[c.clientId] ?? c.clientId}</td>
                    <td>
                      <strong style={{ fontFamily: 'monospace' }}>{c.plate}</strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={isOverdue ? { color: 'var(--color-danger)', fontWeight: 600 } : {}}>
                        {formatDate(c.endDate)} {c.endTime}
                      </span>
                      {isOverdue && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: '0.7rem',
                          background: 'rgba(180,35,24,0.12)',
                          color: 'var(--color-danger)',
                          padding: '1px 6px',
                          borderRadius: 10,
                          fontWeight: 700
                        }}>
                          VENCIDO
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>{c.returnLocation}</td>
                    <td>{branchMap[c.branchId] ?? c.branchId}</td>
                    <td>
                      {c.checkin ? (
                        <span className="badge badge-cerrado">Checkin ✓</span>
                      ) : (
                        <span className="badge badge-peticion">Pendiente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="alert alert-info" style={{ marginTop: 16 }}>
        El checkin se registra desde el módulo de <strong>Contratos</strong>, abriendo el detalle del contrato.
      </div>
    </div>
  );
}
