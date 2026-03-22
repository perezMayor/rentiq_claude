'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  categoryId: string;
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
  categoryId: string;
  categoryName: string;
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
  overlapIds: string[];
  overlapMinHours: number;
  from: string;
  days: number;
}

interface Branch { id: string; name: string; }
interface Category { id: string; name: string; }
type FleetFilter = 'all' | 'group' | 'model';

interface CategoryGroup {
  id: string;
  name: string;
  vehicles: PlanningVehicle[];
  orphans: OrphanReservation[];
}

type SelectedItem =
  | { type: 'reservation'; data: PlanningReservation }
  | { type: 'block'; data: VehicleBlock }
  | { type: 'orphan'; data: OrphanReservation };

type CellInfo =
  | { type: 'reservation'; data: PlanningReservation }
  | { type: 'block'; data: VehicleBlock };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function barPosition(d: string, start: string, end: string): 'start' | 'end' | 'startEnd' | 'middle' {
  if (d === start && d === end) return 'startEnd';
  if (d === start) return 'start';
  if (d === end) return 'end';
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
  if (status === 'PETICION') return 'Petición';
  if (status === 'CONFIRMADA') return 'Confirmada';
  return status;
}

function statusBg(status: ReservationStatus, contractId?: string): string {
  if (contractId) return 'rgba(21,128,61,0.15)';
  if (status === 'PETICION') return 'rgba(245,158,11,0.15)';
  return 'rgba(37,99,235,0.15)';
}

function statusFg(status: ReservationStatus, contractId?: string): string {
  if (contractId) return 'var(--color-status-contratado)';
  if (status === 'PETICION') return 'var(--color-status-peticion)';
  return 'var(--color-status-confirmada)';
}

// ─── Block modal ──────────────────────────────────────────────────────────────

interface ConflictInfo { contractId: string; contractNumber: string; startDate: string; endDate: string; }

function BlockModal({ plate, initialDate, onClose, onCreated }: {
  plate: string; initialDate: string; onClose: () => void; onCreated: () => void;
}) {
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

function InfoPanel({ item, onClose, onDeleteBlock, canWrite }: {
  item: SelectedItem; onClose: () => void; onDeleteBlock: (id: string) => void; canWrite: boolean;
}) {
  if (item.type === 'reservation') {
    const r = item.data;
    return (
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <span className={styles.infoPanelTitle}>{r.number}</span>
          <button className={styles.infoPanelClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.infoPanelRow}>
          <span className={styles.infoPanelRowLabel}>Estado</span>
          <span className={styles.infoPanelBadge} style={{ background: statusBg(r.status, r.contractId), color: statusFg(r.status, r.contractId) }}>
            {statusLabel(r.status, r.contractId)}
          </span>
        </div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Cliente</span>{r.clientName}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Entrada</span>{r.startDate}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Salida</span>{r.endDate}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Matrícula</span>{r.plate}</div>
        {r.pickupLocation && <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Lugar entrega</span>{r.pickupLocation}</div>}
        {r.returnLocation && <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Lugar recogida</span>{r.returnLocation}</div>}
        <div className={styles.infoPanelActions}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.open(`/reservas?tab=gestion&id=${r.id}`, '_blank')}
          >
            Abrir reserva →
          </button>
        </div>
      </div>
    );
  }

  if (item.type === 'orphan') {
    const o = item.data;
    return (
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <span className={styles.infoPanelTitle} style={{ color: 'var(--color-status-huerfana)' }}>{o.number}</span>
          <button className={styles.infoPanelClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.infoPanelRow}>
          <span className={styles.infoPanelRowLabel}>Estado</span>
          <span className={styles.infoPanelBadge} style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--color-status-huerfana)' }}>Sin matrícula</span>
        </div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Cliente</span>{o.clientName}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Entrada</span>{o.startDate}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Salida</span>{o.endDate}</div>
        <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Grupo</span>{o.categoryName}</div>
        {o.pickupLocation && <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Lugar entrega</span>{o.pickupLocation}</div>}
        <div className={styles.infoPanelActions}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.open(`/reservas?tab=gestion&id=${o.id}`, '_blank')}
          >
            Abrir reserva →
          </button>
        </div>
      </div>
    );
  }

  const b = item.data;
  return (
    <div className={styles.infoPanel}>
      <div className={styles.infoPanelHeader}>
        <span className={styles.infoPanelTitle}>Bloqueo manual</span>
        <button className={styles.infoPanelClose} onClick={onClose}>×</button>
      </div>
      <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Matrícula</span>{b.plate}</div>
      <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Desde</span>{b.startDate}</div>
      <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Hasta</span>{b.endDate}</div>
      {b.reason && <div className={styles.infoPanelRow}><span className={styles.infoPanelRowLabel}>Motivo</span>{b.reason}</div>}
      {canWrite && (
        <div className={styles.infoPanelActions}>
          <button className="btn btn-danger btn-sm" onClick={() => onDeleteBlock(b.id)}>Eliminar bloqueo</button>
        </div>
      )}
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function TooltipContent({ item }: { item: SelectedItem }) {
  if (item.type === 'block') {
    return (
      <>
        <div className={styles.tooltipTitle}>Bloqueo manual</div>
        <div className={styles.tooltipRow}>{item.data.startDate} — {item.data.endDate}</div>
        {item.data.reason && <div className={styles.tooltipRow}>{item.data.reason}</div>}
      </>
    );
  }
  if (item.type === 'orphan') {
    const o = item.data;
    return (
      <>
        <div className={styles.tooltipTitle} style={{ color: 'var(--color-status-huerfana)' }}>{o.number}</div>
        <div className={styles.tooltipRow}>{o.clientName}</div>
        <div className={styles.tooltipRow}>{o.startDate} — {o.endDate}</div>
        <span className={styles.tooltipStatus} style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--color-status-huerfana)' }}>Sin matrícula</span>
      </>
    );
  }
  const r = item.data;
  return (
    <>
      <div className={styles.tooltipTitle}>{r.number}</div>
      <div className={styles.tooltipRow}>{r.clientName}</div>
      <div className={styles.tooltipRow}>{r.startDate} — {r.endDate}</div>
      <span className={styles.tooltipStatus} style={{ background: statusBg(r.status, r.contractId), color: statusFg(r.status, r.contractId) }}>
        {statusLabel(r.status, r.contractId)}
      </span>
    </>
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
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: SelectedItem } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state
  const dragRef = useRef<{
    reservationId: string;
    sourcePlate: string | null;
    sourceCategoryId: string;
    sourceCategoryName: string;
    isOrphan: boolean;
  } | null>(null);
  const [dragOverPlate, setDragOverPlate] = useState<string | null>(null);

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
    setLoading(true); setSelectedItem(null);
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

  const dates = useMemo(() => data ? dateRange(data.from, data.days) : [], [data]);

  // Lookup maps
  const reservationsByPlateDate = useMemo(() => {
    const map = new Map<string, Map<string, PlanningReservation>>();
    if (!data) return map;
    for (const r of data.reservations) {
      if (!map.has(r.plate)) map.set(r.plate, new Map());
      for (const d of dates) {
        if (d >= r.startDate && d <= r.endDate) map.get(r.plate)!.set(d, r);
      }
    }
    return map;
  }, [data, dates]);

  const blocksByPlateDate = useMemo(() => {
    const map = new Map<string, Map<string, VehicleBlock>>();
    if (!data) return map;
    for (const b of data.blocks) {
      if (!map.has(b.plate)) map.set(b.plate, new Map());
      for (const d of dates) {
        if (d >= b.startDate && d <= b.endDate) map.get(b.plate)!.set(d, b);
      }
    }
    return map;
  }, [data, dates]);

  const overlapSet = useMemo(() => new Set(data?.overlapIds ?? []), [data]);

  // Category groups: vehicles + orphans grouped by category, sorted alphabetically
  const categoryGroups = useMemo((): CategoryGroup[] => {
    if (!data) return [];
    const map = new Map<string, CategoryGroup>();
    const sorted = [...data.vehicles].sort((a, b) => {
      const g = a.categoryName.localeCompare(b.categoryName, 'es');
      return g !== 0 ? g : a.plate.localeCompare(b.plate, 'es');
    });
    for (const v of sorted) {
      if (!map.has(v.categoryId)) map.set(v.categoryId, { id: v.categoryId, name: v.categoryName, vehicles: [], orphans: [] });
      map.get(v.categoryId)!.vehicles.push(v);
    }
    const activeOrphans = showOrphans ? data.orphans : [];
    for (const o of activeOrphans) {
      if (!map.has(o.categoryId)) map.set(o.categoryId, { id: o.categoryId, name: o.categoryName, vehicles: [], orphans: [] });
      map.get(o.categoryId)!.orphans.push(o);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [data, showOrphans]);

  function getCellInfo(plate: string, dateStr: string): CellInfo | null {
    const block = blocksByPlateDate.get(plate)?.get(dateStr);
    if (block) return { type: 'block', data: block };
    const res = reservationsByPlateDate.get(plate)?.get(dateStr);
    if (res) return { type: 'reservation', data: res };
    return null;
  }

  // ── Tooltip helpers ──

  function showTooltipFor(e: React.MouseEvent, item: SelectedItem) {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ x: e.clientX + 14, y: e.clientY + 14, item });
    }, 220);
  }

  function hideTooltip() {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }

  // ── Cell interactions ──

  function handleEmptyCellClick(vehiclePlate: string, dateStr: string) {
    if (userRole !== 'LECTOR') setBlockModal({ plate: vehiclePlate, date: dateStr });
  }

  async function handleDeleteBlock(id: string) {
    try {
      const res = await fetch(`/api/planning/bloquear/${id}`, { method: 'DELETE' });
      if (res.ok) { setSelectedItem(null); void fetchData(); }
    } catch { /* silent */ }
  }

  // ── Drag & Drop ──

  function handleDragStart(
    e: React.DragEvent,
    reservationId: string,
    sourcePlate: string | null,
    sourceCategoryId: string,
    sourceCategoryName: string,
    isOrphan: boolean
  ) {
    dragRef.current = { reservationId, sourcePlate, sourceCategoryId, sourceCategoryName, isOrphan };
    e.dataTransfer.effectAllowed = 'move';
    hideTooltip();
  }

  async function handleDrop(targetPlate: string, targetCategoryId: string, targetCategoryName: string) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragOverPlate(null);
    if (!drag) return;
    if (drag.sourcePlate === targetPlate) return;

    const doAssign = async () => {
      try {
        const res = await fetch(`/api/reservas/${drag.reservationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedPlate: targetPlate }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          alert(j.error ?? 'Error al reasignar');
          return;
        }
        void fetchData();
      } catch { alert('Error de red al reasignar'); }
    };

    if (drag.sourceCategoryId !== targetCategoryId) {
      const ok = window.confirm(
        `Cambio de grupo\n\nEsta reserva es del grupo "${drag.sourceCategoryName}" y la vas a mover a "${targetCategoryName}".\n\n¿Continuar?`
      );
      if (!ok) return;
    }
    await doAssign();
  }

  // ── Grid layout ──

  const COL_PLATE = 95;
  const COL_GROUP = 110;
  const COL_MODEL = 140;
  const gridTemplateColumns = `${COL_PLATE}px ${COL_GROUP}px ${COL_MODEL}px repeat(${dates.length}, minmax(32px, 1fr))`;
  const totalCols = 3 + dates.length;

  const vehicleCount = data?.vehicles.length ?? 0;
  const occupiedToday = data ? data.reservations.filter((r) => today >= r.startDate && today <= r.endDate).length : 0;

  // ── Render helpers ──

  function renderDayCell(d: string, hasBar: boolean, isToday: boolean, dow: number, onClick: () => void, bar?: React.ReactNode, dragHandlers?: object) {
    const isWeekend = dow === 0 || dow === 6;
    return (
      <div
        key={d}
        className={[
          styles.dayCell,
          isToday ? styles.todayCell : '',
          !isToday && dow === 0 ? styles.sundayCell : (!isToday && isWeekend && !hasBar ? styles.weekendCell : ''),
        ].filter(Boolean).join(' ')}
        onClick={onClick}
        {...dragHandlers}
      >
        {bar}
      </div>
    );
  }

  function renderVehicleRow(vehicle: PlanningVehicle) {
    const isDragOver = dragOverPlate === vehicle.plate;
    return (
      <div key={vehicle.plate} className={styles.vehicleRow}>
        <div className={styles.vehicleCellPlate} style={{ left: 0 }}>
          <div className={styles.vehiclePlate}>{vehicle.plate}</div>
        </div>
        <div className={styles.vehicleCellGroup} style={{ left: COL_PLATE }}>
          <div className={styles.vehicleCategoryBadge}>{vehicle.categoryName}</div>
        </div>
        <div className={`${styles.vehicleCellModel} ${isDragOver ? styles.dragOverRow : ''}`} style={{ left: COL_PLATE + COL_GROUP }}>
          <div className={styles.vehicleModel}>{vehicle.modelName}</div>
        </div>
        {dates.map((d) => {
          const dow = dayOfWeek(d);
          const isToday = d === today;
          const cellInfo = getCellInfo(vehicle.plate, d);
          const isStart = cellInfo?.type === 'reservation' && d === cellInfo.data.startDate;
          const isOverlap = isStart && cellInfo?.type === 'reservation' && overlapSet.has(cellInfo.data.id);

          let bar: React.ReactNode = null;
          if (cellInfo) {
            const pos = barPosition(d, cellInfo.data.startDate, cellInfo.data.endDate);
            const posCls = barClass(pos, styles);
            if (cellInfo.type === 'block') {
              bar = <div className={`${styles.cellBar} ${styles.barBloqueado} ${posCls}`} />;
            } else {
              const colorCls = statusBarClass(cellInfo.data.status, cellInfo.data.contractId, styles);
              const r = cellInfo.data;
              bar = (
                <div
                  className={`${styles.cellBar} ${colorCls} ${posCls} ${isOverlap ? styles.barOverlapStart : ''}`}
                  draggable={userRole !== 'LECTOR'}
                  onDragStart={(e) => handleDragStart(e, r.id, vehicle.plate, vehicle.categoryId, vehicle.categoryName, false)}
                  onDoubleClick={(e) => { e.stopPropagation(); window.open(`/reservas?tab=gestion&id=${r.id}`, '_blank'); }}
                  onMouseEnter={(e) => { e.stopPropagation(); showTooltipFor(e, { type: 'reservation', data: r }); }}
                  onMouseLeave={hideTooltip}
                />
              );
            }
          }

          const dragHandlers = userRole !== 'LECTOR' ? {
            onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverPlate(vehicle.plate); },
            onDragLeave: () => setDragOverPlate(null),
            onDrop: (e: React.DragEvent) => { e.preventDefault(); void handleDrop(vehicle.plate, vehicle.categoryId, vehicle.categoryName); },
          } : {};

          return renderDayCell(
            d, !!cellInfo, isToday, dow,
            () => cellInfo?.type === 'reservation'
              ? setSelectedItem({ type: 'reservation', data: cellInfo.data })
              : cellInfo?.type === 'block'
              ? setSelectedItem({ type: 'block', data: cellInfo.data })
              : handleEmptyCellClick(vehicle.plate, d),
            bar,
            dragHandlers
          );
        })}
      </div>
    );
  }

  function renderOrphanRow(orph: OrphanReservation) {
    return (
      <div key={orph.id} className={styles.vehicleRow}>
        <div className={`${styles.vehicleCellPlate} ${styles.orphanVehicleCell}`} style={{ left: 0 }}>
          <div className={styles.vehiclePlate} style={{ color: 'var(--color-status-huerfana)', fontSize: '0.78rem' }}>{orph.number}</div>
        </div>
        <div className={`${styles.vehicleCellGroup} ${styles.orphanVehicleCell}`} style={{ left: COL_PLATE }}>
          <div className={styles.vehicleCategoryBadge} style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--color-status-huerfana)', borderColor: 'rgba(220,38,38,0.25)' }}>
            Sin matrícula
          </div>
        </div>
        <div className={`${styles.vehicleCellModel} ${styles.orphanVehicleCell}`} style={{ left: COL_PLATE + COL_GROUP }}>
          <div className={styles.vehicleModel}>{orph.clientName}</div>
        </div>
        {dates.map((d) => {
          const dow = dayOfWeek(d);
          const isToday = d === today;
          const inRange = d >= orph.startDate && d <= orph.endDate;
          const pos = inRange ? barPosition(d, orph.startDate, orph.endDate) : null;

          const bar = inRange ? (
            <div
              className={`${styles.cellBar} ${styles.barHuerfana} ${pos ? barClass(pos, styles) : ''}`}
              draggable={userRole !== 'LECTOR'}
              onDragStart={(e) => handleDragStart(e, orph.id, null, orph.categoryId, orph.categoryName, true)}
              onDoubleClick={(e) => { e.stopPropagation(); window.open(`/reservas?tab=gestion&id=${orph.id}`, '_blank'); }}
              onMouseEnter={(e) => { e.stopPropagation(); showTooltipFor(e, { type: 'orphan', data: orph }); }}
              onMouseLeave={hideTooltip}
            />
          ) : null;

          return renderDayCell(
            d, inRange, isToday, dow,
            () => inRange ? setSelectedItem({ type: 'orphan', data: orph }) : undefined,
            bar
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>Planning de Flota</div>
          <div className={styles.sidebarSubtitle}>Vista de disponibilidad</div>
        </div>

        <div className={styles.sidebarBody}>
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Fecha inicio</div>
            <DatePicker className={styles.sidebarInput} value={from} onChange={(v) => setFrom(v)} />
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Periodo</div>
            <select className={styles.sidebarSelect} value={days} onChange={(e) => setDays(Number(e.target.value) as 30 | 60 | 90)}>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Flota</div>
            <select className={styles.sidebarSelect} value={fleetFilter} onChange={(e) => { setFleetFilter(e.target.value as FleetFilter); setCategoryId(''); setPlateSearch(''); }}>
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
              <input type="text" className={styles.sidebarInput} placeholder="Matrícula o modelo..." value={plateSearch} onChange={(e) => setPlateSearch(e.target.value)} />
            )}
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Sucursal</div>
            <select className={styles.sidebarSelect} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Todas</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Lugar</div>
            <select className={styles.sidebarSelect} value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Todos</option>
              {locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className={styles.sidebarSection}>
            <div className={styles.sidebarLabel}>Leyenda</div>
            <div className={styles.legend}>
              {[
                { label: 'Petición',   color: 'var(--color-status-peticion)' },
                { label: 'Confirmada', color: 'var(--color-status-confirmada)' },
                { label: 'Contratado', color: 'var(--color-status-contratado)' },
                { label: 'Bloqueado',  color: 'var(--color-status-bloqueado)' },
                { label: 'Solape',     color: 'var(--color-status-peticion)', stripe: true },
              ].map(({ label, color, stripe }) => (
                <div key={label} className={styles.legendItem}>
                  <div className={styles.legendDot} style={stripe
                    ? { background: `repeating-linear-gradient(45deg, ${color}, ${color} 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)` }
                    : { background: color }
                  } />
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

        <div className={styles.sidebarBottom}>
          <button className={`${styles.sidebarBtn} ${styles.sidebarBtnPrimary}`} onClick={() => window.print()}>
            Exportar PDF
          </button>
          <button className={styles.sidebarBtn} onClick={() => window.open('/reservas', '_blank')}>Ir a Reservas</button>
          <button className={styles.sidebarBtn} onClick={() => window.open('/dashboard', '_blank')}>Ir a Dashboard</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>
        <div className={styles.mainHeader}>
          <span className={styles.mainTitle}>{from} · {days} días</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span className={styles.mainMeta}>{vehicleCount} vehículos</span>
            <span className={styles.mainMeta}>{occupiedToday} ocupados hoy</span>
            {userRole !== 'LECTOR' && (
              <span className={styles.mainHint}>· clic libre = bloquear · doble clic = abrir reserva · arrastrar = reasignar</span>
            )}
          </div>
        </div>

        <div className={styles.mainBody}>
          {loading ? (
            <div className={styles.loadingText}>Cargando planning…</div>
          ) : !data || (data.vehicles.length === 0 && categoryGroups.length === 0) ? (
            <div className={styles.emptyText}>No hay vehículos activos para los filtros seleccionados.</div>
          ) : (
            <div className={styles.gridWrapper}>
              <div className={styles.grid} style={{ gridTemplateColumns }}>
                {/* ── Header ── */}
                <div className={styles.vehicleHeaderCell} style={{ left: 0 }}>Matrícula</div>
                <div className={styles.vehicleHeaderCell} style={{ left: COL_PLATE }}>Grupo</div>
                <div className={styles.vehicleHeaderCell} style={{ left: COL_PLATE + COL_GROUP, borderRight: '2px solid var(--color-border)' }}>Modelo</div>
                {dates.map((d) => {
                  const dow = dayOfWeek(d);
                  const isToday = d === today;
                  return (
                    <div key={d} className={[styles.dayHeader, isToday ? styles.todayHeader : '', !isToday && dow === 0 ? styles.sundayHeader : ''].filter(Boolean).join(' ')}>
                      <span className={styles.dayHeaderNum}>{d.split('-')[2]}</span>
                      <span className={styles.dayHeaderName}>{DAY_NAMES[dow]}</span>
                    </div>
                  );
                })}

                {/* ── Category groups ── */}
                {categoryGroups.map((group) => (
                  <div key={group.id} className={styles.vehicleRow}>
                    {/* Category separator spanning all columns */}
                    <div className={styles.categoryRow} style={{ gridColumn: `1 / span ${totalCols}` }}>
                      {group.name}
                      <span className={styles.categoryRowCount}>{group.vehicles.length} vehículo{group.vehicles.length !== 1 ? 's' : ''}{group.orphans.length > 0 ? ` · ${group.orphans.length} sin asignar` : ''}</span>
                    </div>
                    {group.vehicles.map((v) => renderVehicleRow(v))}
                    {group.orphans.map((o) => renderOrphanRow(o))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <TooltipContent item={tooltip.item} />
        </div>
      )}

      {/* ── Info panel ── */}
      {selectedItem && (
        <InfoPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
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
