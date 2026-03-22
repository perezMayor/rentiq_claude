'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/src/components/DatePicker';
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

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconContract() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-4h8l3 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: 'blue' | 'teal' | 'green' | 'amber' | 'slate';
}) {
  const accentClass = {
    blue:  styles.kpiAccentBlue,
    teal:  styles.kpiAccentTeal,
    green: styles.kpiAccentGreen,
    amber: styles.kpiAccentAmber,
    slate: styles.kpiAccentSlate,
  }[accent];
  return (
    <div className={`${styles.kpiCard} ${accentClass}`}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
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

  const isOk    = row.count === 0;
  const isError = row.count >= 3;
  const dotClass    = isOk ? styles.alertDotOk    : isError ? styles.alertDotError    : styles.alertDotWarn;
  const countClass  = isOk ? styles.alertCountOk  : isError ? styles.alertCountError  : styles.alertCountWarn;

  return (
    <div className={styles.alertRow}>
      <button
        type="button"
        className={styles.alertRowBtn}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`${styles.alertDot} ${dotClass}`} />
        <span className={styles.alertRowLabel}>{row.label}</span>
        <span className={`${styles.alertRowArrow} ${open ? styles.alertRowArrowOpen : ''}`}>▾</span>
        <span className={`${styles.alertRowCount} ${countClass}`}>{row.count}</span>
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
  const prevMax  = Math.max(...prevCats.map((c) => Math.abs(c.saldo)), 1);

  const disponibles = data ? data.flotaActiva - data.contratosAbiertos : null;

  return (
    <div className={styles.dashboard}>

      {/* ── KPI Strip ── */}
      <div className={styles.kpiRow}>
        <KpiCard
          label="Entregas hoy"
          value={data?.entregasHoy ?? '—'}
          sub={data ? `${data.movimientosPr24h} en 24h` : undefined}
          accent="blue"
        />
        <KpiCard
          label="Recogidas hoy"
          value={data?.recogidasHoy ?? '—'}
          accent="teal"
        />
        <KpiCard
          label="Contratos abiertos"
          value={data?.contratosAbiertos ?? '—'}
          sub={data ? `${data.ratioConfirmacion}% confirmación` : undefined}
          accent="blue"
        />
        <KpiCard
          label="Vehículos disponibles"
          value={disponibles ?? '—'}
          sub={data ? `${data.ocupacionFlota}% ocupación` : undefined}
          accent={disponibles !== null && disponibles < 3 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Tareas pendientes"
          value={data?.tareasPendientes ?? '—'}
          accent={data?.tareasPendientes ? 'amber' : 'slate'}
        />
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
            <MiniKpi label="Vehículos disponibles"   value={disponibles ?? '—'} />
            <MiniKpi label="Ocupación flota"         value={data ? `${data.ocupacionFlota}%` : '—'} />
            <MiniKpi label="Contratos abiertos"      value={data?.contratosAbiertos ?? '—'} />
            <MiniKpi label="Confirmación / petición" value={data ? `${data.ratioConfirmacion}%` : '—'} />
            <MiniKpi label="Movimientos próx. 24h"   value={data?.movimientosPr24h ?? '—'} />
          </div>

          {/* Entregas demo */}
          {(data?.entregasDetalle?.length ?? 0) === 0 && data && (
            <div className={styles.entregasRow}>
              <div className={styles.entregasRowTitle}>
                Entregas hoy
                <span style={{ fontWeight: 400, color: 'var(--color-status-peticion)', marginLeft: 6 }}>(demo)</span>
              </div>
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

          {/* Entregas reales */}
          {(data?.entregasDetalle?.length ?? 0) > 0 && (
            <div className={styles.entregasRow}>
              <div className={styles.entregasRowTitle}>Entregas hoy</div>
              <div className={styles.entregasTable}>
                <div className={styles.entregasThead}>
                  <span>Hora</span><span>Cliente</span><span>Vehículo</span><span>Lugar</span>
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
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Alertas</span>
          </div>
          <div className={styles.alertList}>
            <AlertSection row={{ label: 'Automáticas', count: 0, detail: 'Sin alertas automáticas en los próximos 2 días.' }} />
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
            <AlertSection row={{ label: 'Tareas de flota', count: 0, detail: 'Sin tareas de flota pendientes.' }} />
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
              <button type="button" className={styles.applyBtn} onClick={() => setMensualYear(pendingYear)}>
                Aplicar
              </button>
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
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Previsión</span>
          </div>
          <div className={styles.previsionRange}>
            <div className={styles.previsionField}>
              <span className={styles.previsionFieldLabel}>Desde</span>
              <DatePicker className={styles.dateInput} value={prevFrom} onChange={(v) => setPrevFrom(v)} />
            </div>
            <div className={styles.previsionField}>
              <span className={styles.previsionFieldLabel}>Hasta</span>
              <DatePicker className={styles.dateInput} value={prevTo} onChange={(v) => setPrevTo(v)} />
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
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '16px 0' }}>
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
          { label: 'Nueva reserva',  href: '/reservas?tab=gestion',     Icon: IconCalendar },
          { label: 'Nuevo contrato', href: '/contratos?tab=gestion',    Icon: IconContract },
          { label: 'Presupuesto',    href: '/reservas?tab=presupuesto', Icon: IconChart    },
          { label: 'Planning',       href: '/planning',                  Icon: IconCar      },
          { label: 'Gastos',         href: '/gastos',                    Icon: IconUsers    },
        ].map(({ label, href, Icon }) => (
          <button
            key={label}
            type="button"
            className={styles.quickBtn}
            onClick={() => router.push(href)}
          >
            <span className={styles.quickBtnIcon}><Icon /></span>
            {label}
          </button>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        RentIQ · Software de gestión para Rent a Car
      </div>
    </div>
  );
}
