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
}

interface PlanningData {
  vehicles: PlanningVehicle[];
  reservations: PlanningReservation[];
  blocks: VehicleBlock[];
  from: string;
  days: number;
}

interface Branch {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

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

// ─── Cell bar position helper ─────────────────────────────────────────────────

function barPosition(
  dateStr: string,
  startDate: string,
  endDate: string
): 'start' | 'end' | 'startEnd' | 'middle' {
  const isStart = dateStr === startDate || dateStr < startDate;
  const isEnd = dateStr === endDate || dateStr > endDate;
  // isStart: true if this day IS the first day of the bar in the visible range
  const atStart = dateStr === startDate;
  const atEnd = dateStr === endDate;
  if (atStart && atEnd) return 'startEnd';
  if (atStart) return 'start';
  if (atEnd) return 'end';
  void isStart;
  void isEnd;
  return 'middle';
}

function barClass(pos: ReturnType<typeof barPosition>, styles: Record<string, string>): string {
  switch (pos) {
    case 'startEnd': return styles.barStartEnd ?? '';
    case 'start': return styles.barStart ?? '';
    case 'end': return styles.barEnd ?? '';
    default: return styles.barMiddle ?? '';
  }
}

function statusBarClass(
  status: ReservationStatus,
  contractId: string | undefined,
  styles: Record<string, string>
): string {
  if (contractId) return styles.barContratado ?? '';
  switch (status) {
    case 'PETICION': return styles.barPeticion ?? '';
    case 'CONFIRMADA': return styles.barConfirmada ?? '';
    default: return '';
  }
}

function statusLabel(status: ReservationStatus, contractId?: string): string {
  if (contractId) return 'Contratado';
  switch (status) {
    case 'PETICION': return 'Peticion';
    case 'CONFIRMADA': return 'Confirmada';
    default: return status;
  }
}

// ─── Block modal ──────────────────────────────────────────────────────────────

interface BlockModalProps {
  plate: string;
  initialDate: string;
  onClose: () => void;
  onCreated: () => void;
}

interface ConflictInfo {
  contractId: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
}

function BlockModal({ plate, initialDate, onClose, onCreated }: BlockModalProps) {
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[] | null>(null);

  async function submit(override: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/planning/bloquear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate, startDate, endDate, reason: reason || undefined, override }),
      });
      const json = (await res.json()) as {
        error?: string;
        conflicts?: ConflictInfo[];
        block?: VehicleBlock;
      };
      if (res.status === 409 && json.conflicts) {
        setConflicts(json.conflicts);
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setError(json.error ?? 'Error al crear el bloqueo');
        setSaving(false);
        return;
      }
      onCreated();
    } catch {
      setError('Error de red');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal__header">
          <span className="modal__title">Bloquear vehiculo</span>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">x</button>
        </div>
        <div className="modal__body">
          {error && <div className="alert alert-danger">{error}</div>}

          {conflicts && (
            <div className="alert alert-danger">
              <strong>Conflicto con contratos abiertos:</strong>
              <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                {conflicts.map((c) => (
                  <li key={c.contractId} style={{ fontSize: '0.82rem' }}>
                    {c.contractNumber} ({c.startDate} — {c.endDate})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group col-span-2">
              <label className="form-label">Matricula</label>
              <input className="form-input" value={plate} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha inicio</label>
              <DatePicker
                className="form-input"
                value={startDate}
                onChange={(v) => { setStartDate(v); setConflicts(null); }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha fin</label>
              <DatePicker
                className="form-input"
                value={endDate}
                onChange={(v) => { setEndDate(v); setConflicts(null); }}
              />
            </div>
            <div className="form-group col-span-2">
              <label className="form-label">Motivo (opcional)</label>
              <input
                type="text"
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Mantenimiento, ITV..."
              />
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          {conflicts ? (
            <button
              className="btn btn-danger"
              onClick={() => { void submit(true); }}
              disabled={saving}
            >
              Forzar bloqueo (override)
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => { void submit(false); }}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Crear bloqueo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Info panel ───────────────────────────────────────────────────────────────

interface InfoPanelProps {
  info: CellInfo;
  onClose: () => void;
  onDeleteBlock: (id: string) => void;
  canWrite: boolean;
}

function InfoPanel({ info, onClose, onDeleteBlock, canWrite: writeAllowed }: InfoPanelProps) {
  if (info.type === 'reservation') {
    const r = info.data;
    return (
      <div className={styles.infoPanel}>
        <div className={styles.infoPanelHeader}>
          <span className={styles.infoPanelTitle}>{r.number}</span>
          <button className={styles.infoPanelClose} onClick={onClose} aria-label="Cerrar">x</button>
        </div>
        <div className={styles.infoPanelRow}>
          <span className={styles.infoPanelRowLabel}>Estado: </span>
          {statusLabel(r.status, r.contractId)}
        </div>
        <div className={styles.infoPanelRow}>
          <span className={styles.infoPanelRowLabel}>Cliente: </span>
          {r.clientName}
        </div>
        <div className={styles.infoPanelRow}>
          <span className={styles.infoPanelRowLabel}>Fechas: </span>
          {r.startDate} — {r.endDate}
        </div>
        <div className={styles.infoPanelRow}>
          <span className={styles.infoPanelRowLabel}>Matricula: </span>
          {r.plate}
        </div>
        {r.contractId && (
          <div className={styles.infoPanelRow}>
            <span className={styles.infoPanelRowLabel}>Contrato: </span>
            {r.contractId}
          </div>
        )}
      </div>
    );
  }

  const b = info.data;
  return (
    <div className={styles.infoPanel}>
      <div className={styles.infoPanelHeader}>
        <span className={styles.infoPanelTitle}>Bloqueo manual</span>
        <button className={styles.infoPanelClose} onClick={onClose} aria-label="Cerrar">x</button>
      </div>
      <div className={styles.infoPanelRow}>
        <span className={styles.infoPanelRowLabel}>Matricula: </span>
        {b.plate}
      </div>
      <div className={styles.infoPanelRow}>
        <span className={styles.infoPanelRowLabel}>Fechas: </span>
        {b.startDate} — {b.endDate}
      </div>
      {b.reason && (
        <div className={styles.infoPanelRow}>
          <span className={styles.infoPanelRowLabel}>Motivo: </span>
          {b.reason}
        </div>
      )}
      {writeAllowed && (
        <div className={styles.infoPanelActions}>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onDeleteBlock(b.id)}
          >
            Eliminar bloqueo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main planning page ───────────────────────────────────────────────────────

export default function PlanningPage() {
  const today = new Date().toISOString().split('T')[0];

  const [from, setFrom] = useState(today);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [branchId, setBranchId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [plate, setPlate] = useState('');

  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modal state
  const [blockModal, setBlockModal] = useState<{ plate: string; date: string } | null>(null);
  // Info panel state
  const [selectedInfo, setSelectedInfo] = useState<CellInfo | null>(null);
  // User role for write permission
  const [userRole, setUserRole] = useState<string>('LECTOR');

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    info: CellInfo;
  } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch branches and categories for filters
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/sucursales');
        if (res.ok) {
          const json = (await res.json()) as { branches?: Branch[] };
          setBranches(json.branches ?? []);
        }
      } catch { /* silent */ }
      try {
        const res = await fetch('/api/categorias');
        if (res.ok) {
          const json = (await res.json()) as { categories?: Category[] };
          setCategories(json.categories ?? []);
        }
      } catch { /* silent */ }
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const json = (await res.json()) as { role?: string };
          if (json.role) setUserRole(json.role);
        }
      } catch { /* silent */ }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedInfo(null);
    try {
      const params = new URLSearchParams({
        from,
        days: String(days),
      });
      if (branchId) params.set('branchId', branchId);
      if (categoryId) params.set('categoryId', categoryId);
      if (plate) params.set('plate', plate);

      const res = await fetch(`/api/planning?${params.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as PlanningData;
        setData(json);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [from, days, branchId, categoryId, plate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const dates = data ? dateRange(data.from, data.days) : [];

  // Build lookup maps
  // reservationsByPlateDate: plate -> date -> reservation
  const reservationsByPlateDate = new Map<string, Map<string, PlanningReservation>>();
  const blocksByPlateDate = new Map<string, Map<string, VehicleBlock>>();

  if (data) {
    for (const r of data.reservations) {
      if (!reservationsByPlateDate.has(r.plate)) {
        reservationsByPlateDate.set(r.plate, new Map());
      }
      // Mark every date in the range
      for (const d of dates) {
        if (d >= r.startDate && d <= r.endDate) {
          reservationsByPlateDate.get(r.plate)!.set(d, r);
        }
      }
    }

    for (const b of data.blocks) {
      if (!blocksByPlateDate.has(b.plate)) {
        blocksByPlateDate.set(b.plate, new Map());
      }
      for (const d of dates) {
        if (d >= b.startDate && d <= b.endDate) {
          blocksByPlateDate.get(b.plate)!.set(d, b);
        }
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
    if (info) {
      setSelectedInfo(info);
    } else {
      if (userRole !== 'LECTOR') {
        setBlockModal({ plate: vehiclePlate, date: dateStr });
      }
    }
  }

  function handleCellMouseEnter(e: React.MouseEvent, vehiclePlate: string, dateStr: string) {
    const info = getCellInfo(vehiclePlate, dateStr);
    if (!info) return;
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ x: e.clientX + 12, y: e.clientY + 12, info });
    }, 250);
  }

  function handleCellMouseLeave() {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }

  async function handleDeleteBlock(id: string) {
    try {
      const res = await fetch(`/api/planning/bloquear/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedInfo(null);
        void fetchData();
      }
    } catch { /* silent */ }
  }

  // Grid template columns: 180px for vehicle + 36px per day
  const gridTemplateColumns = `180px repeat(${dates.length}, 36px)`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Planning de Flota</h1>
          <p className="page-subtitle">Vista diaria de disponibilidad de vehiculos</p>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.periodGroup}>
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              className={`${styles.periodBtn} ${days === d ? styles.periodBtnActive : ''}`}
              onClick={() => setDays(d)}
            >
              {d} dias
            </button>
          ))}
        </div>

        <DatePicker
          className={styles.dateInput}
          value={from}
          onChange={(v) => setFrom(v)}
        />

        <select
          className={styles.filterSelect}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar matricula..."
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
        />
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'var(--color-status-peticion)' }} />
          <span>Peticion</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'var(--color-status-confirmada)' }} />
          <span>Confirmada</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'var(--color-status-contratado)' }} />
          <span>Contratado</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ background: 'var(--color-status-bloqueado)' }} />
          <span>Bloqueado</span>
        </div>
        {userRole !== 'LECTOR' && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
            Clic en celda libre para bloquear
          </span>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className={styles.loadingText}>Cargando planning...</div>
      ) : !data || data.vehicles.length === 0 ? (
        <div className={styles.emptyText}>No hay vehiculos activos para los filtros seleccionados.</div>
      ) : (
        <div className={styles.gridWrapper}>
          <div
            className={styles.grid}
            style={{ gridTemplateColumns }}
          >
            {/* Header row */}
            <div className={styles.vehicleHeaderCell}>Vehiculo</div>
            {dates.map((d) => {
              const dow = dayOfWeek(d);
              const isToday = d === today;
              const isWeekend = dow === 0 || dow === 6;
              const dayNum = d.split('-')[2];
              return (
                <div
                  key={d}
                  className={`${styles.dayHeader} ${isToday ? styles.todayHeader : ''} ${isWeekend && !isToday ? styles.weekendCol : ''}`}
                >
                  <span className={styles.dayHeaderNum}>{dayNum}</span>
                  <span className={styles.dayHeaderName}>{DAY_NAMES[dow]}</span>
                </div>
              );
            })}

            {/* Vehicle rows */}
            {data.vehicles.map((vehicle) => (
              <div key={vehicle.plate} className={styles.vehicleRow}>
                {/* Vehicle info cell */}
                <div className={styles.vehicleCell}>
                  <div className={styles.vehiclePlate}>{vehicle.plate}</div>
                  <div className={styles.vehicleModel}>{vehicle.modelName}</div>
                  <div className={styles.vehicleCategoryBadge}>{vehicle.categoryName}</div>
                </div>

                {/* Day cells */}
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
                      const pos = barPosition(d, cellInfo.data.startDate, cellInfo.data.endDate);
                      barPosCls = barClass(pos, styles);
                    } else {
                      barCls = statusBarClass(cellInfo.data.status, cellInfo.data.contractId, styles);
                      const pos = barPosition(d, cellInfo.data.startDate, cellInfo.data.endDate);
                      barPosCls = barClass(pos, styles);
                    }
                  }

                  return (
                    <div
                      key={d}
                      className={[
                        styles.dayCell,
                        isToday ? styles.todayCell : '',
                        isWeekend && !cellInfo ? styles.weekendCell : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => handleCellClick(vehicle.plate, d)}
                      onMouseEnter={(e) => handleCellMouseEnter(e, vehicle.plate, d)}
                      onMouseLeave={handleCellMouseLeave}
                      title={undefined}
                    >
                      {cellInfo && (
                        <div className={`${styles.cellBar} ${barCls} ${barPosCls}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.info.type === 'reservation' ? (
            <>
              <div className={styles.tooltipTitle}>{tooltip.info.data.number}</div>
              <div className={styles.tooltipRow}>{tooltip.info.data.clientName}</div>
              <div className={styles.tooltipRow}>
                {tooltip.info.data.startDate} — {tooltip.info.data.endDate}
              </div>
              <span
                className={styles.tooltipStatus}
                style={{
                  background: tooltip.info.data.contractId
                    ? 'rgba(21,128,61,0.15)'
                    : tooltip.info.data.status === 'PETICION'
                    ? 'rgba(245,158,11,0.15)'
                    : 'rgba(37,99,235,0.15)',
                  color: tooltip.info.data.contractId
                    ? 'var(--color-status-contratado)'
                    : tooltip.info.data.status === 'PETICION'
                    ? 'var(--color-status-peticion)'
                    : 'var(--color-status-confirmada)',
                }}
              >
                {statusLabel(tooltip.info.data.status, tooltip.info.data.contractId)}
              </span>
            </>
          ) : (
            <>
              <div className={styles.tooltipTitle}>Bloqueo manual</div>
              <div className={styles.tooltipRow}>
                {tooltip.info.data.startDate} — {tooltip.info.data.endDate}
              </div>
              {tooltip.info.data.reason && (
                <div className={styles.tooltipRow}>{tooltip.info.data.reason}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Info panel */}
      {selectedInfo && (
        <InfoPanel
          info={selectedInfo}
          onClose={() => setSelectedInfo(null)}
          onDeleteBlock={(id) => { void handleDeleteBlock(id); }}
          canWrite={userRole !== 'LECTOR'}
        />
      )}

      {/* Block modal */}
      {blockModal && (
        <BlockModal
          plate={blockModal.plate}
          initialDate={blockModal.date}
          onClose={() => setBlockModal(null)}
          onCreated={() => {
            setBlockModal(null);
            void fetchData();
          }}
        />
      )}
    </div>
  );
}
