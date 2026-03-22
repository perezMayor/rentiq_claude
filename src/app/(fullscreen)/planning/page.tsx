'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReservationStatus, VehicleBlock } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import styles from './planning.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanningVehicle {
  plate: string;
  modelName: string;
  categoryId: string;
  categoryName: string;
  branchId: string;
}

interface PlanningReservation {
  id: string;
  number: string;
  plate: string;
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  contractId?: string;
  clientName: string;
  pickupLocation?: string;
  returnLocation?: string;
}

interface OrphanReservation {
  id: string;
  number: string;
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  clientName: string;
  pickupLocation?: string;
  returnLocation?: string;
}

interface PlanningData {
  vehicles: PlanningVehicle[];
  reservations: PlanningReservation[];
  orphans: OrphanReservation[];
  blocks: VehicleBlock[];
  from: string;
  days: number;
}

interface Branch { id: string; name: string; }
interface Category { id: string; name: string; }

type FleetFilter = 'all' | 'group' | 'model';

type CellInfo =
  | { type: 'reservation'; data: PlanningReservation }
  | { type: 'block'; data: VehicleBlock };

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateRange(from: string, days: number): string[] {
  const result: string[] = [];
  const start = new Date(from + 'T12:00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    result.push(d.toISOString().split('T')[0]);
  }
  return result;
}

function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay();
}

const DAY_NAMES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// ─── Bar helpers ──────────────────────────────────────────────────────────────

function barPosition(dateStr: string, startDate: string, endDate: string): 'start' | 'end' | 'startEnd' | 'middle' {
  if (dateStr === startDate && dateStr === endDate) return 'startEnd';
  if (dateStr === startDate) return 'start';
  if (dateStr === endDate) return 'end';
  return 'middle';
}

function barClass(pos: ReturnType<typeof barPosition>, s: Record<string, string>): string {
  switch (pos) {
    case 'startEnd': return s.barStartEnd ?? '';
    case 'start':    return s.barStart ?? '';
    case 'end':      return s.barEnd ?? '';
    default:         return s.barMiddle ?? '';
  }
}

function statusBarClass(status: ReservationStatus, contractId: string | undefined, s: Record<string, string>): string {
  if (contractId) return s.barContratado ?? '';
  if (status === 'PETICION') return s.barPeticion ?? '';
  if (status === 'CONFIRMADA') return s.barConfirmada ?? '';
  return '';
}

function statusLabel(status: ReservationStatus, contractId?: string): string {
  if (contractId) return 'Contratado';
  if (status === 'PETICION') return 'Peticion';
  if (status === 'CONFIRMADA') return 'Confirmada';
  return status;
}

// ─── Block modal ──────────────────────────────────────────────────────────────

interface ConflictInfo { contractId: string; contractNumber: string; startDate: string; endDate: string; }

function BlockModal({ plate, initialDate, onClose, onCreated }: { plate: string; initialDate: string; onClose: () => void; onCreated: () => void; }) {
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[] | null>(null);

  async function submit(override: boolean) {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/planning/bloquear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate, startDate, endDate, reason: reason || undefined, override }),
      });
      const json = (await res.json()) as { error?: string; conflicts?: ConflictInfo[] };
      if (res.status === 409 && json.conflicts) { setConflicts(json.conflicts); setSaving(false); return; }
      if (!res.ok) { setError(json.error ?? 'Error al crear el bloqueo'); setSaving(false); return; }
      onCreated();
    } catch { setError('Error de red'); setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal__header">
          <span className="modal__title">Bloquear vehículo</span>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>
        <div className="modal__body">
          {error && <div className="alert alert-danger">{error}</div>}
          {conflicts && (
            <div className="alert alert-danger">
              <strong>Conflicto con contratos abiertos:</strong>
              <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                {conflicts.map((c) => <li key={c.contractId} style={{ fontSize: '0.82rem' }}>{c.contractNumber} ({c.startDate} — {c.endDate})</li>)}
              </ul>
            </div>
          )}
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label className="form-label">Matrícula</label>
              <input className="form-input" value={plate} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha inicio</label>
              <DatePicker className="form-input" value={startDate} onChange={(v) => { setStartDate(v); setConflicts(null); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha fin</label>
              <DatePicker className="form-input" value={endDate} onChange={(v) => { setEndDate(v); setConflicts(null); }} />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Motivo (opcional)</label>
              <input type="text" className="form-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Mantenimiento, ITV..." />
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          {conflicts ? (
            <button className="btn btn-danger" onClick={() => { void submit(true); }} disabled={saving}>Forzar bloqueo</button>
          ) : (
            <button className="btn btn-primary" onClick={() => { void submit(false); }} disabled={saving}>{saving ? 'Guardando...' : 'Crear bloqueo'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function InfoPanel({ info, onClose, onDeleteBlock, canWrite }: { info: CellInfo; onClose: () => void; onDeleteBlock: (id: string) => void; canWrite: boolean; }) {
  if (info.type === 'reservation') {
    const r = info.data;
    return (
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <span className={styles.infoPanelTitle}>{r.number}</span>
          <button className={styles.infoPanelClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Estado: </span>{statusLabel(r.status, r.contractId)}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Cliente: </span>{r.clientName}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Fechas: </span>{r.startDate} — {r.endDate}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Matrícula: </span>{r.plate}</div>
        {r.pickupLocation && <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Entrega: </span>{r.pickupLocation}</div>}
        {r.returnLocation && <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Recogida: </span>{r.returnLocation}</div>}
      </div>
    );
  }
  const b = info.data;
  return (
    <div className={styles.infoPanel}>
      <div className={styles.infoPanelHeader}>
        <span className={styles.infoPanelTitle}>Bloqueo manual</span>
        <button className={styles.infoPanelClose} onClick={onClose}>×</button>
      </div>
      <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Matrícula: </span>{b.plate}</div>
      <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Fechas: </span>{b.startDate} — {b.endDate}</div>
      {b.reason && <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Motivo: </span>{b.reason}</div>}
      {canWrite && (
        <div className={styles.infoPanelActions}>
          <button className="btn btn-danger btn-sm" onClick={() => onDeleteBlock(b.id)}>Eliminar bloqueo</button>
        </div>
      )}
    </div>
  );
}

// ─── Main planning page ───────────────────────────────────────────────────────

export default function PlanningPage() {
  const today = new Date().toISOString().split('T')[0];

  // Filter state
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('all');
  const [categoryId, setCategoryId] = useState('');
  const [plateSearch, setPlateSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Reference data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>('LECTOR');

  // Grid data
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(false);

  // UI state
  const [showOrphans, setShowOrphans] = useState(true);
  const [blockModal, setBlockModal] = useState<{ plate: string; date: string } | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<CellInfo | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; info: CellInfo } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load reference data once
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/sucursales');
        if (res.ok) { const j = (await res.json()) as { branches?: Branch[] }; setBranches(j.branches ?? []); }
      } catch { /* silent */ }
      try {
        const res = await fetch('/api/categorias');
        if (res.ok) { const j = (await res.json()) as { categories?: Category[] }; setCategories(j.categories ?? []); }
      } catch { /* silent */ }
      try {
        const res = await fetch('/api/gestor/empresa');
        if (res.ok) { const j = (await res.json()) as { settings?: { deliveryLocations?: string[] } }; setLocations(j.settings?.deliveryLocations ?? []); }
      } catch { /* silent */ }
      try {
        const res = await fetch('/api/me');
        if (res.ok) { const j = (await res.json()) as { role?: string }; if (j.role) setUserRole(j.role); }
      } catch { /* silent */ }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setSelectedInfo(null);
    try {
      const params = new URLSearchParams({ from, days: String(days) });
      if (branchId) params.set('branchId', branchId);
      if (fleetFilter === 'group' && categoryId) params.set('categoryId', categoryId);
      if (fleetFilter === 'model' && plateSearch.trim()) params.set('plate', plateSearch.trim());
      if (locationFilter) params.set('location', locationFilter);
      const res = await fetch(`/api/planning?${params.toString()}`);
      if (res.ok) { const j = (await res.json()) as PlanningData; setData(j); }
    } catch { /* silent */ }
    setLoading(false);
  }, [from, days, branchId, fleetFilter, categoryId, plateSearch, locationFilter]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const dates = data ? dateRange(data.from, data.days) : [];

  // Build lookup maps
  const reservationsByPlateDate = new Map<string, Map<string, PlanningReservation>>();
  const blocksByPlateDate = new Map<string, Map<string, VehicleBlock>>();

  if (data) {
    for (const r of data.reservations) {
      if (!reservationsByPlateDate.has(r.plate)) reservationsByPlateDate.set(r.plate, new Map());
      for (const d of dates) {
        if (d >= r.startDate && d <= r.endDate) reservationsByPlateDate.get(r.plate)!.set(d, r);
      }
    }
    for (const b of data.blocks) {
      if (!blocksByPlateDate.has(b.plate)) blocksByPlateDate.set(b.plate, new Map());
      for (const d of dates) {
        if (d >= b.startDate && d <= b.endDate) blocksByPlateDate.get(b.plate)!.set(d, b);
      }
    }
  }

  function getCellInfo(plate: string, dateStr: string): CellInfo | null {
    const block = blocksByPlateDate.get(plate)?.get(dateStr);
    if (block) return { type: 'block', data: block };
    const res = reservationsByPlateDate.get(plate)?.get(dateStr);
    if (res) return { type: 'reservation', data: res };
    return null;
  }

  function handleCellClick(vehiclePlate: string, dateStr: string) {
    const info = getCellInfo(vehiclePlate, dateStr);
    if (info) { setSelectedInfo(info); }
    else if (userRole !== 'LECTOR') { setBlockModal({ plate: vehiclePlate, date: dateStr }); }
  }

  function handleCellMouseEnter(e: React.MouseEvent, vehiclePlate: string, dateStr: string) {
    const info = getCellInfo(vehiclePlate, dateStr);
    if (!info) return;
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => { setTooltip({ x: e.clientX + 12, y: e.clientY + 12, info }); }, 250);
  }

  function handleCellMouseLeave() {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }

  async function handleDeleteBlock(id: string) {
    try {
      const res = await fetch(`/api/planning/bloquear/${id}`, { method: 'DELETE' });
      if (res.ok) { setSelectedInfo(null); void fetchData(); }
    } catch { /* silent */ }
  }

  const COL_PLATE = 95;
  const COL_GROUP = 110;
  const COL_MODEL = 140;
  const gridTemplateColumns = `${COL_PLATE}px ${COL_GROUP}px ${COL_MODEL}px repeat(${dates.length}, 36px)`;

  // Sort vehicles alphabetically by group name, then plate
  const sortedVehicles = data
    ? [...data.vehicles].sort((a, b) => {
        const g = a.categoryName.localeCompare(b.categoryName, 'es');
        return g !== 0 ? g : a.plate.localeCompare(b.plate, 'es');
      })
    : [];

  // Active vehicle + reservation counts for header
  const vehicleCount = data?.vehicles.length ?? 0;
  const occupiedToday = data ? data.reservations.filter((r) => today >= r.startDate && today <= r.endDate).length : 0;
  const orphans = (showOrphans && data?.orphans) ? data.orphans : [];

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>Planning de Flota</div>
          <div className={styles.sidebarSubtitle}>Vista de disponibilidad</div>
        </div>

        <div className={styles.sidebarBody}>
          {/* Fecha */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Fecha inicio</div>
            <DatePicker className={styles.sidebarInput} value={from} onChange={(v) => setFrom(v)} />
          </div>

          {/* Periodo */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Periodo</div>
            <select
              className={styles.sidebarSelect}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) as 30 | 60 | 90)}
            >
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
          </div>

          {/* Flota */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Flota</div>
            <select
              className={styles.sidebarSelect}
              value={fleetFilter}
              onChange={(e) => { setFleetFilter(e.target.value as FleetFilter); setCategoryId(''); setPlateSearch(''); }}
            >
              <option value="all">Toda la flota</option>
              <option value="group">Por grupos</option>
              <option value="model">Por marca / modelo</option>
            </select>
            {fleetFilter === 'group' && (
              <select className={styles.sidebarSelect} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Todos los grupos</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {fleetFilter === 'model' && (
              <input
                type="text"
                className={styles.sidebarInput}
                placeholder="Matrícula o modelo..."
                value={plateSearch}
                onChange={(e) => setPlateSearch(e.target.value)}
              />
            )}
          </div>

          {/* Sucursal */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Sucursal</div>
            <select className={styles.sidebarSelect} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Todas</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Lugar */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Lugar</div>
            <select className={styles.sidebarSelect} value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Todos</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Leyenda */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Leyenda</div>
            <div className={styles.legend}>
              {[
                { label: 'Petición',   color: 'var(--color-status-peticion)' },
                { label: 'Confirmada', color: 'var(--color-status-confirmada)' },
                { label: 'Contratado', color: 'var(--color-status-contratado)' },
                { label: 'Bloqueado',  color: 'var(--color-status-bloqueado)' },
              ].map(({ label, color }) => (
                <div key={label} className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ background: color }} />
                  <span>{label}</span>
                </div>
              ))}
              <button
                className={`${styles.legendItem} ${styles.legendToggle} ${showOrphans ? styles.legendToggleActive : ''}`}
                onClick={() => setShowOrphans((v) => !v)}
                type="button"
              >
                <div className={styles.legendDot} style={{ background: 'var(--color-status-huerfana)', opacity: showOrphans ? 1 : 0.35 }} />
                <span style={{ opacity: showOrphans ? 1 : 0.5 }}>Huérfanas</span>
                <span className={styles.legendToggleBadge}>{showOrphans ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div className={styles.sidebarBottom}>
          <button className={`${styles.sidebarBtn} ${styles.sidebarBtnPrimary}`} onClick={() => window.print()}>
            Exportar PDF
          </button>
          <button className={styles.sidebarBtn} onClick={() => window.open('/reservas', '_blank')}>
            Ir a Reservas
          </button>
          <button className={styles.sidebarBtn} onClick={() => window.open('/dashboard', '_blank')}>
            Ir a Dashboard
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>
        <div className={styles.mainHeader}>
          <div>
            <span className={styles.mainTitle}>
              {from} · {days} días
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span className={styles.mainMeta}>{vehicleCount} vehículos</span>
            <span className={styles.mainMeta}>{occupiedToday} ocupados hoy</span>
            {userRole !== 'LECTOR' && (
              <span className={styles.mainHint}>Clic en celda libre para bloquear</span>
            )}
          </div>
        </div>

        <div className={styles.mainBody}>
          {loading ? (
            <div className={styles.loadingText}>Cargando planning…</div>
          ) : !data || data.vehicles.length === 0 ? (
            <div className={styles.emptyText}>No hay vehículos activos para los filtros seleccionados.</div>
          ) : (
            <div className={styles.gridWrapper}>
              <div className={styles.grid} style={{ gridTemplateColumns }}>
                {/* Header */}
                <div className={styles.vehicleHeaderCell} style={{ left: 0 }}>Matrícula</div>
                <div className={styles.vehicleHeaderCell} style={{ left: COL_PLATE }}>Grupo</div>
                <div className={styles.vehicleHeaderCell} style={{ left: COL_PLATE + COL_GROUP, borderRight: '2px solid var(--color-border)' }}>Modelo</div>
                {dates.map((d) => {
                  const dow = dayOfWeek(d);
                  const isToday = d === today;
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <div key={d} className={`${styles.dayHeader} ${isToday ? styles.todayHeader : ''} ${isWeekend && !isToday ? styles.weekendCol ?? '' : ''}`}>
                      <span className={styles.dayHeaderNum}>{d.split('-')[2]}</span>
                      <span className={styles.dayHeaderName}>{DAY_NAMES[dow]}</span>
                    </div>
                  );
                })}

                {/* Rows */}
                {sortedVehicles.map((vehicle) => (
                  <div key={vehicle.plate} className={styles.vehicleRow}>
                    <div className={styles.vehicleCellPlate} style={{ left: 0 }}>
                      <div className={styles.vehiclePlate}>{vehicle.plate}</div>
                    </div>
                    <div className={styles.vehicleCellGroup} style={{ left: COL_PLATE }}>
                      <div className={styles.vehicleCategoryBadge}>{vehicle.categoryName}</div>
                    </div>
                    <div className={styles.vehicleCellModel} style={{ left: COL_PLATE + COL_GROUP }}>
                      <div className={styles.vehicleModel}>{vehicle.modelName}</div>
                    </div>
                    {dates.map((d) => {
                      const dow = dayOfWeek(d);
                      const isToday = d === today;
                      const isWeekend = dow === 0 || dow === 6;
                      const cellInfo = getCellInfo(vehicle.plate, d);
                      let barCls = '';
                      let barPosCls = '';
                      if (cellInfo) {
                        if (cellInfo.type === 'block') {
                          barCls = styles.barBloqueado ?? '';
                          barPosCls = barClass(barPosition(d, cellInfo.data.startDate, cellInfo.data.endDate), styles);
                        } else {
                          barCls = statusBarClass(cellInfo.data.status, cellInfo.data.contractId, styles);
                          barPosCls = barClass(barPosition(d, cellInfo.data.startDate, cellInfo.data.endDate), styles);
                        }
                      }
                      return (
                        <div
                          key={d}
                          className={[styles.dayCell, isToday ? styles.todayCell : '', isWeekend && !cellInfo ? styles.weekendCell : ''].filter(Boolean).join(' ')}
                          onClick={() => handleCellClick(vehicle.plate, d)}
                          onMouseEnter={(e) => handleCellMouseEnter(e, vehicle.plate, d)}
                          onMouseLeave={handleCellMouseLeave}
                        >
                          {cellInfo && <div className={`${styles.cellBar} ${barCls} ${barPosCls}`} />}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* ── Huérfanas ── */}
                {orphans.length > 0 && (
                  <>
                    {/* Separator row — spans the 3 fixed cols + all day cols */}
                    <div className={styles.orphanSeparator} style={{ gridColumn: `1 / span ${3 + dates.length}` }}>
                      Sin matrícula asignada ({orphans.length})
                    </div>

                    {orphans.map((orph) => (
                      <div key={orph.id} className={styles.vehicleRow}>
                        <div className={`${styles.vehicleCellPlate} ${styles.orphanVehicleCell}`} style={{ left: 0 }}>
                          <div className={styles.vehiclePlate} style={{ color: 'var(--color-status-huerfana)', fontSize: '0.78rem' }}>{orph.number}</div>
                        </div>
                        <div className={`${styles.vehicleCellGroup} ${styles.orphanVehicleCell}`} style={{ left: COL_PLATE }}>
                          <div className={styles.vehicleCategoryBadge} style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--color-status-huerfana)', borderColor: 'rgba(220,38,38,0.25)' }}>Sin matrícula</div>
                        </div>
                        <div className={`${styles.vehicleCellModel} ${styles.orphanVehicleCell}`} style={{ left: COL_PLATE + COL_GROUP }}>
                          <div className={styles.vehicleModel}>{orph.clientName}</div>
                        </div>
                        {dates.map((d) => {
                          const inRange = d >= orph.startDate && d <= orph.endDate;
                          const dow = dayOfWeek(d);
                          const isWeekend = dow === 0 || dow === 6;
                          const pos = inRange ? barPosition(d, orph.startDate, orph.endDate) : null;
                          const posCls = pos ? barClass(pos, styles) : '';
                          return (
                            <div
                              key={d}
                              className={[styles.dayCell, isWeekend && !inRange ? styles.weekendCell : ''].filter(Boolean).join(' ')}
                              onClick={() => inRange && setSelectedInfo({ type: 'orphan' as never, data: orph as never })}
                              onMouseEnter={(e) => {
                                if (!inRange) return;
                                if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                                tooltipTimer.current = setTimeout(() => setTooltip({ x: e.clientX + 12, y: e.clientY + 12, info: { type: 'orphan' as never, data: orph as never } }), 250);
                              }}
                              onMouseLeave={handleCellMouseLeave}
                            >
                              {inRange && <div className={`${styles.cellBar} ${styles.barHuerfana} ${posCls}`} />}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.info.type === 'reservation' ? (
            <>
              <div className={styles.tooltipTitle}>{tooltip.info.data.number}</div>
              <div className={styles.tooltipRow}>{tooltip.info.data.clientName}</div>
              <div className={styles.tooltipRow}>{tooltip.info.data.startDate} — {tooltip.info.data.endDate}</div>
              <span
                className={styles.tooltipStatus}
                style={{
                  background: tooltip.info.data.contractId ? 'rgba(21,128,61,0.15)' : tooltip.info.data.status === 'PETICION' ? 'rgba(245,158,11,0.15)' : 'rgba(37,99,235,0.15)',
                  color: tooltip.info.data.contractId ? 'var(--color-status-contratado)' : tooltip.info.data.status === 'PETICION' ? 'var(--color-status-peticion)' : 'var(--color-status-confirmada)',
                }}
              >
                {statusLabel(tooltip.info.data.status, tooltip.info.data.contractId)}
              </span>
            </>
          ) : tooltip.info.type === ('orphan' as string) ? (
            <>
              <div className={styles.tooltipTitle} style={{ color: 'var(--color-status-huerfana)' }}>
                {(tooltip.info.data as unknown as OrphanReservation).number}
              </div>
              <div className={styles.tooltipRow}>{(tooltip.info.data as unknown as OrphanReservation).clientName}</div>
              <div className={styles.tooltipRow}>
                {(tooltip.info.data as unknown as OrphanReservation).startDate} — {(tooltip.info.data as unknown as OrphanReservation).endDate}
              </div>
              <span className={styles.tooltipStatus} style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--color-status-huerfana)' }}>
                Sin matrícula
              </span>
            </>
          ) : (
            <>
              <div className={styles.tooltipTitle}>Bloqueo manual</div>
              <div className={styles.tooltipRow}>{tooltip.info.data.startDate} — {tooltip.info.data.endDate}</div>
              {tooltip.info.data.reason && <div className={styles.tooltipRow}>{tooltip.info.data.reason}</div>}
            </>
          )}
        </div>
      )}

      {/* ── Info panel ── */}
      {selectedInfo && (
        <InfoPanel
          info={selectedInfo}
          onClose={() => setSelectedInfo(null)}
          onDeleteBlock={(id) => { void handleDeleteBlock(id); }}
          canWrite={userRole !== 'LECTOR'}
        />
      )}

      {/* ── Block modal ── */}
      {blockModal && (
        <BlockModal
          plate={blockModal.plate}
          initialDate={blockModal.date}
          onClose={() => setBlockModal(null)}
          onCreated={() => { setBlockModal(null); void fetchData(); }}
        />
      )}
    </div>
  );
}
