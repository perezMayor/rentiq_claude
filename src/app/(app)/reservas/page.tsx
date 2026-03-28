'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Reservation, Client, VehicleCategory, CompanyBranch, ReservationStatus, Contract } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import ReservaForm from './ReservaForm';
import GestionReservaTab from './GestionReservaTab';
import PresupuestosTab from './PresupuestosTab';
import styles from './reservas.module.css';
import PrintButton from '@/src/components/PrintButton';

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
    if (key === 'planning') { router.push('/planning'); return; }
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
          {t.key === 'planning' && (
            <span
              role="button"
              aria-label="Abrir planning en nueva pestaña"
              onClick={(e) => { e.stopPropagation(); window.open('/planning', '_blank'); }}
              style={{ marginLeft: 5, opacity: 0.55, fontSize: '0.75em', cursor: 'pointer', verticalAlign: 'middle' }}
            >
              ↗
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ─── Entregas sub-tab ─────────────────────────────────────────────────────────

type EntregaFiltro = 'todas' | 'contratadas' | 'sin_matricula';

interface EntregaRow {
  id: string;
  numero: string;
  clientId: string;
  plate: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  pickupLocation: string;
  branchId: string;
  contratada: boolean;
  sinMatricula: boolean;
  flightNumber: string;
  billedDays: number;
  total: number;
  extras: { extraId: string; quantity: number; total: number }[];
  notes: string;
}

function EntregasTab() {
  const today = todayStr();
  const [dateFrom, setDateFrom]         = useState(today);
  const [dateTo, setDateTo]             = useState(today);
  const [filtro, setFiltro]             = useState<EntregaFiltro>('todas');
  const [rows, setRows]                 = useState<EntregaRow[]>([]);
  const [clients, setClients]           = useState<Client[]>([]);
  const [locations, setLocations]       = useState<string[]>([]);
  const [extraCatalog, setExtraCatalog] = useState<Record<string, string>>({}); // extraId → name
  const [filterLocation, setFilterLocation] = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [hasSearched, setHasSearched]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes'),
      fetch('/api/locations'),
      fetch('/api/vehiculos/extras'),
    ]).then(async ([cr, lr, er]) => {
      if (cr.ok) setClients((await cr.json()).clients ?? []);
      if (lr.ok) setLocations((await lr.json()).locations ?? []);
      if (er.ok) {
        const extras: { id: string; name: string }[] = (await er.json()).extras ?? [];
        setExtraCatalog(Object.fromEntries(extras.map((e) => [e.id, e.name])));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const cp = new URLSearchParams({ from: dateFrom, to: dateTo });
        const [contratosRes, reservasRes] = await Promise.all([
          fetch(`/api/contratos?${cp}`),
          fetch(`/api/reservas?startFrom=${dateFrom}&startTo=${dateTo}`),
        ]);
        if (!contratosRes.ok || !reservasRes.ok) throw new Error('Error al cargar datos');

        const contratos: Contract[]   = ((await contratosRes.json()).contracts ?? [])
          .filter((c: Contract) => c.status !== 'CANCELADO');
        const reservas: Reservation[] = ((await reservasRes.json()).reservations ?? [])
          .filter((r: Reservation) => r.status !== 'CANCELADA' && !r.contractId);

        const contratoIds = new Set(contratos.map((c) => c.reservationId).filter(Boolean));

        const fromContratos: EntregaRow[] = contratos.map((c) => ({
          id:            c.id,
          numero:        c.number,
          clientId:      c.clientId,
          plate:         c.plate ?? '',
          startDate:     c.startDate,
          startTime:     c.startTime ?? '',
          endDate:       c.endDate,
          endTime:       c.endTime ?? '',
          pickupLocation: c.pickupLocation ?? '',
          branchId:      c.branchId,
          contratada:    true,
          sinMatricula:  !c.plate,
          flightNumber:  c.flightNumber ?? '',
          billedDays:    c.billedDays,
          total:         c.total,
          extras:        c.extras ?? [],
          notes:         c.internalNotes ?? c.notes ?? '',
        }));

        const fromReservas: EntregaRow[] = reservas
          .filter((r) => !contratoIds.has(r.id))
          .map((r) => ({
            id:            r.id,
            numero:        r.number,
            clientId:      r.clientId,
            plate:         r.assignedPlate ?? '',
            startDate:     r.startDate,
            startTime:     r.startTime ?? '',
            endDate:       r.endDate,
            endTime:       r.endTime ?? '',
            pickupLocation: r.pickupLocation ?? '',
            branchId:      r.branchId ?? '',
            contratada:    false,
            sinMatricula:  !r.assignedPlate,
            flightNumber:  r.flightNumber ?? '',
            billedDays:    r.billedDays,
            total:         r.total,
            extras:        r.extras ?? [],
            notes:         r.internalNotes ?? r.notes ?? '',
          }));

        setRows([...fromContratos, ...fromReservas].sort((a, b) =>
          a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime)
        ));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateFrom, dateTo]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`]));

  const filtered = rows.filter((r) => {
    if (filtro === 'contratadas'   && !r.contratada)   return false;
    if (filtro === 'sin_matricula' && !r.sinMatricula) return false;
    if (filterLocation && r.pickupLocation !== filterLocation) return false;
    return true;
  });

  const tdBase: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: '0.84rem',
    color: 'var(--color-text-primary)',
    borderBottom: 'none',
    verticalAlign: 'middle',
  };

  return (
    <div>
      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <DatePicker className="form-input" value={dateFrom} onChange={(v) => { setDateFrom(v); setHasSearched(true); }} style={{ width: 'auto' }} />
        <DatePicker className="form-input" value={dateTo}   onChange={(v) => { setDateTo(v); setHasSearched(true); }}   style={{ width: 'auto' }} />
        <select className="form-select" value={filtro} onChange={(e) => { setFiltro(e.target.value as EntregaFiltro); setHasSearched(true); }} style={{ width: 'auto' }}>
          <option value="todas">Todas</option>
          <option value="contratadas">Contratadas</option>
          <option value="sin_matricula">Sin matrícula</option>
        </select>
        <select className="form-select" value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); setHasSearched(true); }} style={{ width: 'auto' }}>
          <option value="">Todos los lugares</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setHasSearched(true)}>
          Listar
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          {filtered.length} entrega{filtered.length !== 1 ? 's' : ''}
        </span>
        {hasSearched && filtered.length > 0 && <PrintButton label="Imprimir listado" />}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!hasSearched ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
      ) : loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🚗</div>
          <div className="empty-state__text">No hay entregas para el período seleccionado.</div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 88 }} />{/* Fecha */}
            <col style={{ width: 56 }} />{/* Hora */}
            <col style={{ width: 160 }} />{/* Lugar */}
            <col style={{ width: 90 }} />{/* Vuelo */}
            <col />{/* Nombre */}
            <col style={{ width: 96 }} />{/* Matrícula */}
            <col style={{ width: 48 }} />{/* Días */}
            <col style={{ width: 96 }} />{/* Devolución */}
            <col style={{ width: 80 }} />{/* Importe */}
            <col style={{ width: 100 }} />{/* Estado */}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              {['Fecha','Hora','Lugar entrega','Vuelo','Nombre','Matrícula','Días','F. devolución','Importe','Estado'].map((h) => (
                <th key={h} style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const hasDetail = r.extras.length > 0 || !!r.notes;
              const rowBorder = hasDetail ? undefined : '1px solid var(--color-border)';
              return (
                <React.Fragment key={r.id}>
                  <tr>
                    <td style={{ ...tdBase, borderBottom: rowBorder, whiteSpace: 'nowrap' }}>{formatDate(r.startDate)}</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder, whiteSpace: 'nowrap' }}>{r.startTime || '—'}</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.pickupLocation}>{r.pickupLocation || '—'}</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder, color: 'var(--color-text-muted)' }}>{r.flightNumber || '—'}</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={clientMap[r.clientId]}>{clientMap[r.clientId] ?? '—'}</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder }}>
                      {r.plate
                        ? <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.plate}</span>
                        : <span style={{ color: 'var(--color-danger)', fontSize: '0.78rem' }}>Sin asignar</span>
                      }
                    </td>
                    <td style={{ ...tdBase, borderBottom: rowBorder, textAlign: 'center' }}>{r.billedDays}</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder, whiteSpace: 'nowrap' }}>{formatDate(r.endDate)}</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.total.toFixed(2)} €</td>
                    <td style={{ ...tdBase, borderBottom: rowBorder }}>
                      {r.contratada
                        ? <span className="badge badge-confirmada">Contratada</span>
                        : <span className="badge badge-peticion">Sin contrato</span>
                      }
                    </td>
                  </tr>
                  {hasDetail && (
                    <tr>
                      <td colSpan={10} style={{ padding: '2px 10px 10px', borderBottom: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {r.extras.length > 0 && (
                          <span style={{ marginRight: 16 }}>
                            <strong>Extras:</strong>{' '}
                            {r.extras.map((e, i) => (
                              <span key={e.extraId}>
                                {extraCatalog[e.extraId] ?? e.extraId}
                                {e.quantity > 1 ? ` ×${e.quantity}` : ''}
                                {' '}({e.total.toFixed(2)} €)
                                {i < r.extras.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </span>
                        )}
                        {r.notes && (
                          <span>
                            <strong>Observaciones:</strong> {r.notes}
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Recogidas sub-tab ────────────────────────────────────────────────────────

type RecogidaFiltro = 'todas' | 'vencidas' | 'sin_checkin';

function RecogidasTab() {
  const today                                     = todayStr();
  const [dateFrom, setDateFrom]                   = useState(today);
  const [dateTo, setDateTo]                       = useState(today);
  const [filtro, setFiltro]                       = useState<RecogidaFiltro>('todas');
  const [filterLocation, setFilterLocation]       = useState('');
  const [contracts, setContracts]                 = useState<Contract[]>([]);
  const [clients, setClients]                     = useState<Client[]>([]);
  const [branches, setBranches]                   = useState<CompanyBranch[]>([]);
  const [locations, setLocations]                 = useState<string[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [error, setError]                         = useState('');
  const [hasSearched, setHasSearched]             = useState(false);

  useEffect(() => {
    Promise.all([fetch('/api/clientes'), fetch('/api/sucursales'), fetch('/api/locations')]).then(async ([cr, br, lr]) => {
      if (cr.ok) setClients((await cr.json()).clients ?? []);
      if (br.ok) setBranches((await br.json()).branches ?? []);
      if (lr.ok) setLocations((await lr.json()).locations ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Contratos cuya devolución cae en el rango
        const params = new URLSearchParams({ status: 'ABIERTO' });
        const res = await fetch(`/api/contratos?${params}`);
        if (!res.ok) throw new Error('Error al cargar contratos');
        const data = await res.json();
        setContracts((data.contracts ?? []).filter(
          (c: Contract) => c.endDate >= dateFrom && c.endDate <= dateTo && c.checkout
        ));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateFrom, dateTo]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`]));
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  const filtered = contracts.filter((c) => {
    if (filtro === 'vencidas'   && !(c.endDate < today && !c.checkin)) return false;
    if (filtro === 'sin_checkin' && c.checkin)                          return false;
    if (filterLocation && c.returnLocation !== filterLocation)          return false;
    return true;
  });

  return (
    <div>
      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <DatePicker className="form-input" value={dateFrom} onChange={(v) => { setDateFrom(v); setHasSearched(true); }} style={{ width: 'auto' }} />
        <DatePicker className="form-input" value={dateTo}   onChange={(v) => { setDateTo(v); setHasSearched(true); }}   style={{ width: 'auto' }} />
        <select className="form-select" value={filtro} onChange={(e) => { setFiltro(e.target.value as RecogidaFiltro); setHasSearched(true); }} style={{ width: 'auto' }}>
          <option value="todas">Todas</option>
          <option value="sin_checkin">Sin checkin</option>
          <option value="vencidas">Vencidas</option>
        </select>
        <select className="form-select" value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); setHasSearched(true); }} style={{ width: 'auto' }}>
          <option value="">Todos los lugares</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setHasSearched(true)}>
          Listar
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          {filtered.length} recogida{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔑</div>
            <div className="empty-state__text">No hay recogidas para el período seleccionado.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contrato</th><th>Cliente</th><th>Vehículo</th>
                <th>Fecha devolución</th><th>Hora</th><th>Lugar recogida</th><th>Sucursal</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isOverdue = c.endDate < today && !c.checkin;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{c.number}</td>
                    <td>{clientMap[c.clientId] ?? c.clientId}</td>
                    <td><strong style={{ fontFamily: 'monospace' }}>{c.plate}</strong></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={isOverdue ? { color: 'var(--color-danger)', fontWeight: 600 } : {}}>
                        {formatDate(c.endDate)}
                      </span>
                      {isOverdue && (
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', background: 'rgba(180,35,24,0.12)', color: 'var(--color-danger)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                          VENCIDO
                        </span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.endTime || '—'}</td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 180 }}>{c.returnLocation || '—'}</td>
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
    </div>
  );
}

// ─── Planning redirect ────────────────────────────────────────────────────────

function PlanningRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/planning'); }, [router]);
  return null;
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

// ─── Canales tab ──────────────────────────────────────────────────────────────

interface SalesChannel { id: string; name: string; code: string; active: boolean; }

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function CanalesTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const load = useCallback((y: number) => {
    setLoading(true); setError('');
    Promise.all([
      fetch('/api/canales'),
      fetch(`/api/reservas?startFrom=${y}-01-01&startTo=${y}-12-31`),
    ])
      .then(async ([chRes, rvRes]) => {
        const chData = chRes.ok ? await chRes.json() : { channels: [] };
        const rvData = rvRes.ok ? await rvRes.json() : { reservations: [] };
        setChannels(chData.channels ?? []);
        setReservations(rvData.reservations ?? []);
      })
      .catch(() => setError('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  // Build analytics matrix
  const rows = useMemo(() => {
    // map: channelId (or '__none__') → monthly counts [0..11]
    const matrix: Record<string, number[]> = {};
    const clientsPerChannel: Record<string, Set<string>> = {};

    for (const r of reservations) {
      const key = r.salesChannelId ?? '__none__';
      if (!matrix[key]) { matrix[key] = Array(12).fill(0); clientsPerChannel[key] = new Set(); }
      const month = new Date(r.startDate).getMonth(); // 0-based
      matrix[key][month]++;
      if (r.clientId) clientsPerChannel[key].add(r.clientId);
    }

    const totalAll = reservations.length;

    const channelRows = channels.map((ch) => {
      const counts = matrix[ch.id] ?? Array(12).fill(0);
      const total = counts.reduce((a, b) => a + b, 0);
      const pct = totalAll > 0 ? ((total / totalAll) * 100).toFixed(1) : '0.0';
      return { id: ch.id, name: ch.name, counts, total, pct };
    });

    // Sin canal row
    const noneCounts = matrix['__none__'] ?? Array(12).fill(0);
    const noneTotal = noneCounts.reduce((a, b) => a + b, 0);
    const nonePct = totalAll > 0 ? ((noneTotal / totalAll) * 100).toFixed(1) : '0.0';

    // Totals row
    const totalCounts = Array(12).fill(0);
    for (let m = 0; m < 12; m++) {
      for (const row of channelRows) totalCounts[m] += row.counts[m];
      totalCounts[m] += noneCounts[m];
    }

    return { channelRows, noneCounts, noneTotal, nonePct, totalCounts, totalAll };
  }, [channels, reservations]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <label style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>Año:</label>
        <select
          value={year}
          onChange={(e) => { setYear(Number(e.target.value)); setHasSearched(true); }}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface-strong)', color: 'var(--color-text-primary)', fontFamily: 'inherit', fontSize: '0.9rem' }}
        >
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {rows.totalAll} reservas en {year}
        </span>
      </div>

      {!hasSearched ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Selecciona un año para ver el resumen de canales.</div>
      ) : <div className="table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Canal</th>
              {MONTHS.map((m) => <th key={m} style={{ textAlign: 'center', minWidth: 48 }}>{m}</th>)}
              <th style={{ textAlign: 'center', minWidth: 60 }}>Total</th>
              <th style={{ textAlign: 'center', minWidth: 60 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.channelRows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 500 }}>{row.name}</td>
                {row.counts.map((c, i) => (
                  <td key={i} style={{ textAlign: 'center', color: c === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{c === 0 ? '–' : c}</td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.total}</td>
                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{row.pct}%</td>
              </tr>
            ))}
            {rows.noneTotal > 0 && (
              <tr>
                <td style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin canal</td>
                {rows.noneCounts.map((c, i) => (
                  <td key={i} style={{ textAlign: 'center', color: c === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{c === 0 ? '–' : c}</td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{rows.noneTotal}</td>
                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{rows.nonePct}%</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--color-border)', background: 'var(--color-surface)' }}>
              <td style={{ fontWeight: 700 }}>Total</td>
              {rows.totalCounts.map((c, i) => (
                <td key={i} style={{ textAlign: 'center', fontWeight: 600, color: c === 0 ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{c === 0 ? '–' : c}</td>
              ))}
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{rows.totalAll}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>100%</td>
            </tr>
          </tfoot>
        </table>
      </div>}
    </div>
  );
}

// ─── Log confirmaciones tab ───────────────────────────────────────────────────

function LogConfirmacionesTab() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true); setError('');
    Promise.all([
      fetch(`/api/reservas?status=CONFIRMADA&startFrom=${dateFrom}&startTo=${dateTo}`),
      fetch('/api/clientes'),
    ])
      .then(async ([rRes, cRes]) => {
        const rData = rRes.ok ? await rRes.json() : { reservations: [] };
        const cData = cRes.ok ? await cRes.json() : { clients: [] };
        setReservations(rData.reservations ?? []);
        setClients(cData.clients ?? []);
      })
      .catch(() => setError('Error al cargar los datos'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  return (
    <div>
      <div className="filters-bar">
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Desde</label>
          <DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setHasSearched(true); }} style={{ width: 150 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Hasta</label>
          <DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setHasSearched(true); }} style={{ width: 150 }} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setHasSearched(true)}>
          Listar
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Total</th>
                <th>Confirmación enviada</th>
                <th>Destinatario</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Sin reservas confirmadas en el periodo</td></tr>
              ) : reservations.map((r) => {
                const client = clientMap[r.clientId];
                return (
                  <tr key={r.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.85rem' }}>{r.number}</span></td>
                    <td>{client ? `${client.name}${client.surname ? ' ' + client.surname : ''}` : <span className="text-muted">{r.clientId}</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.startDate)} <span className="text-muted" style={{ fontSize: '0.75rem' }}>{r.startTime}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.endDate)} <span className="text-muted" style={{ fontSize: '0.75rem' }}>{r.endTime}</span></td>
                    <td style={{ fontWeight: 600 }}>{r.total.toFixed(2)} €</td>
                    <td style={{ fontSize: '0.82rem', color: r.confirmationSentAt ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {r.confirmationSentAt ? new Date(r.confirmationSentAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{r.confirmationSentTo ?? '—'}</td>
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
  const [hasSearched, setHasSearched] = useState(false);

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
        <select className="form-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setHasSearched(true); }} style={{ width: 'auto' }}>
          <option value="">Todos los estados</option>
          <option value="PETICION">Petición</option>
          <option value="CONFIRMADA">Confirmada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        {storeData.branches.length > 1 && (
          <select className="form-select" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setHasSearched(true); }} style={{ width: 'auto' }}>
            <option value="">Todas las sucursales</option>
            {storeData.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <DatePicker className="form-input" value={filterFrom} onChange={(v) => { setFilterFrom(v); setHasSearched(true); }} style={{ width: 'auto' }} />
        <DatePicker className="form-input" value={filterTo} onChange={(v) => { setFilterTo(v); setHasSearched(true); }} style={{ width: 'auto' }} />
        <input type="search" className="form-input" value={filterSearch} onChange={(e) => { setFilterSearch(e.target.value); setHasSearched(true); }} placeholder="Buscar número, matrícula…" style={{ minWidth: 200 }} />
        <button className="btn btn-primary btn-sm" onClick={() => { setHasSearched(true); loadReservations(); }}>Listar</button>
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
        {!hasSearched ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '24px 0', textAlign: 'center' }}>Aplica los filtros para ver el listado.</div>
        ) : loading ? (
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
        {['entregas', 'recogidas', 'listado', 'canales', 'log'].includes(tab) && <PrintButton />}
      </div>
      <TabNav active={tab} />
      {tab === 'gestion'     && <GestionReservaTab reservationId={reservationId} />}
      {tab === 'entregas'    && <EntregasTab />}
      {tab === 'recogidas'   && <RecogidasTab />}
      {tab === 'listado'     && <ListadoTab />}
      {tab === 'canales'     && <CanalesTab />}
      {tab === 'log'         && <LogConfirmacionesTab />}
      {tab === 'planning'    && <PlanningRedirect />}
      {tab === 'informes'    && <PlaceholderTab label="Informes de reservas" />}
      {tab === 'presupuesto' && <PresupuestosTab />}
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
