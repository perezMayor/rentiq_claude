import { cookies } from 'next/headers';
import { parseSession } from '@/src/lib/auth';
import { readStore } from '@/src/lib/store';
import { getEvents } from '@/src/lib/audit';
import type { AuditEvent } from '@/src/lib/types';
import styles from './dashboard.module.css';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: 'Inicio de sesión',
  AUTH_LOGOUT: 'Cierre de sesión',
  UI_OPEN_MODULE: 'Módulo abierto',
  RBAC_DENIED: 'Acceso denegado',
  OVERRIDE_CONFIRMATION: 'Override confirmado',
  SYSTEM: 'Evento del sistema',
  AUDIT_SUPPRESS: 'Supresión de auditoría',
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('rq_v3_session')?.value ?? '';
  const session = parseSession(token);

  const store = readStore();
  const user = session ? store.users.find((u) => u.id === session.userId) : null;

  // KPIs
  const activeReservations = store.reservations.filter(
    (r) => r.status === 'PETICION' || r.status === 'CONFIRMADA'
  ).length;

  const openContracts = store.contracts.filter((c) => c.status === 'ABIERTO').length;

  const activeVehicles = store.vehicles.filter((v) => v.active).length;

  const pendingInvoices = store.invoices.filter((i) => i.status === 'BORRADOR').length;

  // Recent audit events
  let recentEvents: AuditEvent[] = [];
  try {
    recentEvents = await getEvents(10);
  } catch {
    // audit log may not exist yet
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Bienvenido/a, {user?.name ?? 'Usuario'} — {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card__label">Reservas activas</div>
          <div className="kpi-card__value">{activeReservations}</div>
          <div className="kpi-card__sub">petición + confirmadas</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Contratos abiertos</div>
          <div className="kpi-card__value" style={{ color: 'var(--color-accent)' }}>
            {openContracts}
          </div>
          <div className="kpi-card__sub">en curso</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Vehículos activos</div>
          <div className="kpi-card__value" style={{ color: 'var(--color-status-contratado)' }}>
            {activeVehicles}
          </div>
          <div className="kpi-card__sub">en flota</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card__label">Facturas pendientes</div>
          <div
            className="kpi-card__value"
            style={{ color: pendingInvoices > 0 ? 'var(--color-status-peticion)' : 'var(--color-text-muted)' }}
          >
            {pendingInvoices}
          </div>
          <div className="kpi-card__sub">en borrador</div>
        </div>
      </div>

      {/* Quick links */}
      <div className={styles.quickLinks}>
        <a href="/reservas" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📋</span>
          <span>Nueva Reserva</span>
        </a>
        <a href="/contratos" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📄</span>
          <span>Ver Contratos</span>
        </a>
        <a href="/planning" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📅</span>
          <span>Planning</span>
        </a>
        <a href="/vehiculos" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>🚙</span>
          <span>Flota</span>
        </a>
      </div>

      {/* Recent audit events */}
      <div className="card" style={{ marginTop: 28 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Actividad reciente</h2>
          <a href="/gestor" className="btn btn-ghost btn-sm">Ver auditoría completa</a>
        </div>

        {recentEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__text">No hay eventos registrados aún</div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Actor</th>
                  <th>Entidad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(ev.at)}
                    </td>
                    <td>{ACTION_LABELS[ev.action] ?? ev.action}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{ev.actorId}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>
                      {ev.entity ? `${ev.entity}${ev.entityId ? ` #${ev.entityId}` : ''}` : '—'}
                    </td>
                    <td>
                      {ev.suppressedAt ? (
                        <span className="badge badge-cancelada">Suprimido</span>
                      ) : ev.action === 'RBAC_DENIED' ? (
                        <span className="badge badge-cancelada">Denegado</span>
                      ) : (
                        <span className="badge badge-confirmada">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
