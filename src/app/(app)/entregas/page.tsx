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

export default function EntregasPage() {
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
        // Entregas = ABIERTO contracts starting on the selected date with no checkout
        const entregas = (data.contracts ?? []).filter(
          (c: Contract) => c.startDate === selectedDate && !c.checkout
        );
        setContracts(entregas);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Entregas</h1>
          <p className="page-subtitle">
            {contracts.length} entrega{contracts.length !== 1 ? 's' : ''} pendiente{contracts.length !== 1 ? 's' : ''} · {formatDate(selectedDate)}
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
            <div className="empty-state__icon">🚗</div>
            <div className="empty-state__text">
              No hay entregas pendientes para esta fecha.
              {' '}Los contratos sin checkout se muestran aquí en su fecha de inicio.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Cliente</th>
                <th>Vehículo</th>
                <th>Hora salida</th>
                <th>Lugar entrega</th>
                <th>Retorno</th>
                <th>Sucursal</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{c.number}</td>
                  <td>{clientMap[c.clientId] ?? c.clientId}</td>
                  <td>
                    <strong style={{ fontFamily: 'monospace' }}>{c.plate}</strong>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.startTime}</td>
                  <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>{c.pickupLocation}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                    {formatDate(c.endDate)} {c.endTime}
                  </td>
                  <td>{branchMap[c.branchId] ?? c.branchId}</td>
                  <td>
                    {c.checkout ? (
                      <span className="badge badge-cerrado">Checkout ✓</span>
                    ) : (
                      <span className="badge badge-peticion">Pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="alert alert-info" style={{ marginTop: 16 }}>
        El checkout se registra desde el módulo de <strong>Contratos</strong>, abriendo el detalle del contrato.
      </div>
    </div>
  );
}
