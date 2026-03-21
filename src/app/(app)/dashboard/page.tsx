'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoriaData {
  id: string;
  code: string;
  name: string;
  total: number;
  ocupados: number;
  saldo: number;
}

interface EntregaDetalle {
  lugar: string;
  fecha: string;
  hora: string;
  nombre: string;
  coche: string;
}

interface DashboardData {
  entregasHoy: number;
  entregasDetalle: EntregaDetalle[];
  recogidasHoy: number;
  tareasPendientes: number;
  facturasBorrador: number;
  facturasBorradorDetalle: string[];
  recogidaVencidaCount: number;
  recogidaVencidaDetalle: string[];
  reservasHoy: number;
  contratosAbiertos: number;
  reservasSinConfirmar: number;
  reservasHuerfanas: number;
  contratosSinMatricula: number;
  entregasHoySinContrato: number;
  ocupacionFlota: number;
  ratioConfirmacion: number;
  movimientosPr24h: number;
  gruposDeficit: number;
  flotaActiva: number;
  monthly: { entregas: number[]; reservas: number[] };
  categorias: CategoriaData[];
  saldoGlobal: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiStrip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.kpiStrip}>
      <div className={styles.kpiStripLabel}>{label}</div>
      <div className={styles.kpiStripValue}>{value}</div>
    </div>
  );
}

function MiniKpi({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`${styles.miniKpi} ${highlight ? styles.miniKpiHL : ''}`}>
      <div className={styles.miniKpiLabel}>{label}</div>
      <div className={styles.miniKpiValue}>{value}</div>
    </div>
  );
}

interface AlertRow {
  label: string;
  count: number;
  detail?: string;
  items?: string[];
}

function AlertSection({ row }: { row: AlertRow }) {
  const [open, setOpen] = useState(false);
  const hasContent = row.detail || (row.items && row.items.length > 0);
  return (
    <div className={styles.alertRow}>
      <button
        type="button"
        className={styles.alertRowBtn}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.alertRowLabel}>{row.label}</span>
        <span className={styles.alertRowArrow}>{open ? '▴' : '▾'}</span>
        <span className={styles.alertRowCount}>{row.count}</span>
      </button>
      {open && hasContent && (
        <div className={styles.alertRowDetail}>
          {row.detail && <div>{row.detail}</div>}
          {row.items && row.items.length > 0 && (
            <ul className={styles.alertRowItems}>
              {row.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function HBar({ value, max, positive }: { value: number; max: number; positive?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={styles.hbarTrack}>
      <div
        className={`${styles.hbarFill} ${positive === false ? styles.hbarNeg : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [mensualTab, setMensualTab] = useState<'entregas' | 'reservas'>('entregas');
  const [mensualYear, setMensualYear] = useState(new Date().getFullYear());
  const [pendingYear, setPendingYear] = useState(new Date().getFullYear());
  const [prevFrom, setPrevFrom] = useState(todayStr());
  const [prevTo, setPrevTo] = useState(todayStr());
  const [prevData, setPrevData] = useState<CategoriaData[] | null>(null);
  const [prevSaldo, setPrevSaldo] = useState<number>(0);

  async function loadData(year: number) {
    try {
      const res = await fetch(`/api/store-summary?year=${year}`);
      if (!res.ok) return;
      const d: DashboardData = await res.json();
      setData(d);
      setPrevData(d.categorias);
      setPrevSaldo(d.saldoGlobal);
    } catch { /* silent */ }
  }

  useEffect(() => { loadData(mensualYear); }, [mensualYear]);

  async function applyPrevision() {
    if (!data) return;
    // Re-fetch with date range for previsión
    try {
      const res = await fetch(`/api/store-summary?year=${mensualYear}&from=${prevFrom}&to=${prevTo}`);
      if (!res.ok) return;
      const d: DashboardData = await res.json();
      setPrevData(d.categorias);
      setPrevSaldo(d.saldoGlobal);
    } catch { /* silent */ }
  }

  const monthlyValues = data
    ? (mensualTab === 'entregas' ? data.monthly.entregas : data.monthly.reservas)
    : Array(12).fill(0);
  const monthlyMax = Math.max(...monthlyValues, 1);

  const prevCats = prevData ?? data?.categorias ?? [];
  const prevMax = Math.max(...prevCats.map((c) => Math.abs(c.saldo)), 1);

  return (
    <div className={styles.dashboard}>

      {/* ── Top KPI strip ── */}
      <div className={styles.topStrip}>
        <KpiStrip label="Entregas hoy" value={data?.entregasHoy ?? '—'} />
        <KpiStrip label="Recogidas hoy" value={data?.recogidasHoy ?? '—'} />
        <KpiStrip label="Tareas pendientes" value={data?.tareasPendientes ?? '—'} />
      </div>

      {/* ── Agenda + Alertas ── */}
      <div className={styles.mainRow}>

        {/* Agenda */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Agenda</span>
          </div>
          <div className={styles.agendaGrid}>
            <MiniKpi label="Flota activa"             value={data?.flotaActiva ?? '—'} />
            <MiniKpi label="Vehículos disponibles"   value={data ? data.flotaActiva - data.contratosAbiertos : '—'} />
            <MiniKpi label="Ocupación flota"         value={data ? `${data.ocupacionFlota}%` : '—'} />
            <MiniKpi label="Contratos abiertos"      value={data?.contratosAbiertos ?? '—'} />
            <MiniKpi label="Confirmación / petición" value={data ? `${data.ratioConfirmacion}%` : '—'} />
            <MiniKpi label="Movimientos próx. 24h"   value={data?.movimientosPr24h ?? '—'} />
          </div>

          {/* DEMO — borrar cuando se confirme el diseño */}
          {(data?.entregasDetalle?.length ?? 0) === 0 && data && (
            <div className={styles.entregasRow}>
              <div className={styles.entregasRowTitle}>Entregas hoy <span style={{ fontWeight: 400, color: 'var(--color-status-peticion)', marginLeft: 6 }}>(demo)</span></div>
              <div className={styles.entregasTable}>
                <div className={styles.entregasThead}>
                  <span>Hora</span><span>Cliente</span><span>Vehículo</span><span>Lugar</span>
                </div>
                {[
                  { hora: '09:00', nombre: 'Carlos Martínez López', coche: '1234 ABC', lugar: 'Aeropuerto T2' },
                  { hora: '11:30', nombre: 'Ana Gómez Ruiz',        coche: '5678 DEF', lugar: 'Oficina central' },
                  { hora: '14:00', nombre: 'Roberto Sánchez',       coche: '9012 GHI', lugar: 'Puerto de Cartagena' },
                ].map((e, i) => (
                  <div key={i} className={styles.entregasTrow}>
                    <span className={styles.entregasHora}>{e.hora}</span>
                    <span>{e.nombre}</span>
                    <span className={styles.entregasCoche}>{e.coche}</span>
                    <span className={styles.entregasLugar}>{e.lugar}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fila entregas del día — solo si hay */}
          {(data?.entregasDetalle?.length ?? 0) > 0 && (
            <div className={styles.entregasRow}>
              <div className={styles.entregasRowTitle}>Entregas hoy</div>
              <div className={styles.entregasTable}>
                <div className={styles.entregasThead}>
                  <span>Hora</span>
                  <span>Cliente</span>
                  <span>Vehículo</span>
                  <span>Lugar</span>
                </div>
                {data!.entregasDetalle.map((e, i) => (
                  <div key={i} className={styles.entregasTrow}>
                    <span className={styles.entregasHora}>{e.hora}</span>
                    <span>{e.nombre}</span>
                    <span className={styles.entregasCoche}>{e.coche}</span>
                    <span className={styles.entregasLugar}>{e.lugar}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className={`${styles.card} ${styles.alertasCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Alertas</span>
          </div>
          <div className={styles.alertList}>
            <AlertSection row={{
              label: 'Automáticas',
              count: 0,
              detail: 'Sin alertas automáticas en los próximos 2 días.',
            }} />
            <AlertSection row={{
              label: 'Reservas sin confirmar',
              count: data?.reservasSinConfirmar ?? 0,
              detail: (data?.reservasSinConfirmar ?? 0) === 0 ? 'Todas las reservas están confirmadas.' : undefined,
            }} />
            <AlertSection row={{
              label: 'Reservas huérfanas',
              count: data?.reservasHuerfanas ?? 0,
              detail: (data?.reservasHuerfanas ?? 0) === 0 ? 'Sin reservas sin contrato asociado.' : undefined,
            }} />
            <AlertSection row={{
              label: 'Contratos sin matrícula',
              count: data?.contratosSinMatricula ?? 0,
              detail: (data?.contratosSinMatricula ?? 0) === 0 ? 'Todos los contratos tienen matrícula asignada.' : undefined,
            }} />
            <AlertSection row={{
              label: 'Entregas sin contrato',
              count: data?.entregasHoySinContrato ?? 0,
              detail: (data?.entregasHoySinContrato ?? 0) === 0 ? 'Todas las entregas de hoy tienen contrato.' : undefined,
            }} />
            <AlertSection row={{
              label: 'Facturas en borrador',
              count: data?.facturasBorrador ?? 0,
              detail: (data?.facturasBorrador ?? 0) === 0 ? 'Sin facturas pendientes de emitir.' : undefined,
              items: data?.facturasBorradorDetalle,
            }} />
            <AlertSection row={{
              label: 'Recogidas vencidas',
              count: data?.recogidaVencidaCount ?? 0,
              items: data?.recogidaVencidaDetalle,
              detail: (data?.recogidaVencidaCount ?? 0) === 0 ? 'Sin recogidas vencidas.' : undefined,
            }} />
            <AlertSection row={{
              label: 'Grupos en déficit',
              count: data?.gruposDeficit ?? 0,
              detail: (data?.gruposDeficit ?? 0) === 0 ? 'Sin grupos con déficit de flota.' : undefined,
            }} />
            <AlertSection row={{
              label: 'Tareas de flota',
              count: 0,
              detail: 'Sin tareas de flota pendientes.',
            }} />
          </div>
        </div>
      </div>

      {/* ── Resumen mensual + Previsión ── */}
      <div className={styles.mainRow}>

        {/* Resumen mensual */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Resumen mensual</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className={styles.tabPills}>
                <button
                  type="button"
                  className={`${styles.pill} ${mensualTab === 'entregas' ? styles.pillActive : ''}`}
                  onClick={() => setMensualTab('entregas')}
                >Entregas</button>
                <button
                  type="button"
                  className={`${styles.pill} ${mensualTab === 'reservas' ? styles.pillActive : ''}`}
                  onClick={() => setMensualTab('reservas')}
                >Reservas</button>
              </div>
              <span className={styles.yearLabel}>Año</span>
              <input
                type="number"
                className={styles.yearInput}
                value={pendingYear}
                onChange={(e) => setPendingYear(Number(e.target.value))}
                min={2020}
                max={2099}
              />
              <button
                type="button"
                className={styles.applyBtn}
                onClick={() => setMensualYear(pendingYear)}
              >Aplicar</button>
            </div>
          </div>

          <div className={styles.barChart}>
            {MESES.map((mes, i) => (
              <div key={mes} className={styles.barRow}>
                <span className={styles.barLabel}>{mes}</span>
                <HBar value={monthlyValues[i]} max={monthlyMax} />
                <span className={styles.barValue}>{monthlyValues[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Previsión */}
        <div className={`${styles.card} ${styles.previsionCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Previsión</span>
          </div>

          <div className={styles.previsionRange}>
            <div className={styles.previsionField}>
              <span className={styles.previsionFieldLabel}>Desde</span>
              <input
                type="date"
                className={styles.dateInput}
                value={prevFrom}
                onChange={(e) => setPrevFrom(e.target.value)}
              />
            </div>
            <div className={styles.previsionField}>
              <span className={styles.previsionFieldLabel}>Hasta</span>
              <input
                type="date"
                className={styles.dateInput}
                value={prevTo}
                onChange={(e) => setPrevTo(e.target.value)}
              />
            </div>
            <button type="button" className={styles.applyBtn} onClick={applyPrevision}>
              Aplicar
            </button>
          </div>

          <div className={styles.saldoGlobal}>
            <span>Saldo global</span>
            <span className={prevSaldo >= 0 ? styles.saldoPos : styles.saldoNeg}>
              {prevSaldo >= 0 ? `+${prevSaldo}` : prevSaldo}
            </span>
          </div>

          <div className={styles.previsionList}>
            {prevCats.length === 0 ? (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', padding: '16px 0' }}>
                Sin categorías activas
              </div>
            ) : (
              prevCats.map((cat) => (
                <div key={cat.id} className={styles.previsionRow}>
                  <span className={styles.previsionCode}>{cat.code}</span>
                  <HBar value={Math.abs(cat.saldo)} max={prevMax} positive={cat.saldo >= 0} />
                  <span className={`${styles.previsionSaldo} ${cat.saldo > 0 ? styles.saldoPos : cat.saldo < 0 ? styles.saldoNeg : styles.saldoZero}`}>
                    {cat.saldo > 0 ? `+${cat.saldo}` : cat.saldo}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Accesos rápidos ── */}
      <div className={styles.quickBar}>
        {[
          { label: 'Nueva reserva',  href: '/reservas?tab=gestion' },
          { label: 'Nuevo contrato', href: '/contratos?tab=gestion' },
          { label: 'Presupuesto',    href: '/reservas?tab=presupuesto' },
          { label: 'Planning',       href: '/planning' },
          { label: 'Gastos',         href: '/gastos' },
        ].map((a) => (
          <button
            key={a.label}
            type="button"
            className={styles.quickBtn}
            onClick={() => router.push(a.href)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        RentIQ: Software de gestión para Rent a Car
      </div>
    </div>
  );
}
