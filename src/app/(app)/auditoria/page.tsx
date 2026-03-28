'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AuditEvent, AuditAction } from '@/src/lib/types';
import styles from './auditoria.module.css';

const ACTION_LABELS: Record<AuditAction, string> = {
  AUTH_LOGIN: 'Login',
  AUTH_LOGOUT: 'Logout',
  UI_OPEN_MODULE: 'UI',
  RBAC_DENIED: 'Denegado',
  OVERRIDE_CONFIRMATION: 'Override',
  SYSTEM: 'Sistema',
  AUDIT_SUPPRESS: 'Supresión',
};

const ACTION_CLASS: Record<AuditAction, string> = {
  AUTH_LOGIN: styles.actionAuth,
  AUTH_LOGOUT: styles.actionAuth,
  UI_OPEN_MODULE: styles.actionUi,
  RBAC_DENIED: styles.actionRbac,
  OVERRIDE_CONFIRMATION: styles.actionOverride,
  SYSTEM: styles.actionSystem,
  AUDIT_SUPPRESS: styles.actionSuppress,
};

function formatTs(ts: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const date = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}

const LIMIT_OPTIONS = [50, 100, 200, 500];

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [limit, setLimit] = useState(100);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  // Suppress modal
  const [suppressEvent, setSuppressEvent] = useState<AuditEvent | null>(null);
  const [suppressReason, setSuppressReason] = useState('');
  const [suppressSaving, setSuppressSaving] = useState(false);
  const [suppressError, setSuppressError] = useState('');

  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setUserRole(d.role ?? '')).catch(() => {});
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/audit-log?limit=${limit}`);
      if (!res.ok) throw new Error('Error al cargar auditoría');
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Client-side filtering
  const filtered = events.filter((e) => {
    if (filterAction && e.action !== filterAction) return false;
    if (filterActor && !e.actorId.toLowerCase().includes(filterActor.toLowerCase())) return false;
    if (filterEntity && (e.entity ?? '').toLowerCase() !== filterEntity.toLowerCase()) return false;
    return true;
  });

  async function handleSuppress() {
    if (!suppressEvent) return;
    setSuppressSaving(true);
    setSuppressError('');
    try {
      const res = await fetch('/api/audit-log', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: suppressEvent.id, reason: suppressReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setSuppressEvent(null);
      setSuppressReason('');
      await loadEvents();
    } catch (e) {
      setSuppressError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSuppressSaving(false);
    }
  }

  const uniqueEntities = [...new Set(events.map((e) => e.entity).filter(Boolean))].sort();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoría</h1>
          <p className="page-subtitle">
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''} (mostrando últimos {limit})
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ width: 'auto' }}
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>Últimos {n}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={loadEvents}>
            Listar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="form-select"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Todas las acciones</option>
          {(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]} ({a})</option>
          ))}
        </select>
        <select
          className="form-select"
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Todas las entidades</option>
          {uniqueEntities.map((e) => (
            <option key={e} value={e!}>{e}</option>
          ))}
        </select>
        <input
          type="text"
          className="form-input"
          value={filterActor}
          onChange={(e) => setFilterActor(e.target.value)}
          placeholder="ID actor…"
          style={{ width: 180 }}
        />
        {(filterAction || filterActor || filterEntity) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setFilterAction(''); setFilterActor(''); setFilterEntity(''); }}
          >
            Limpiar
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="table-wrapper">
        {loading ? (
          <div className={styles.loadingRow}>Cargando auditoría…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <div className="empty-state__text">No hay eventos de auditoría.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Acción</th>
                <th>Actor</th>
                <th>Rol</th>
                <th>Entidad</th>
                <th>Detalles</th>
                {isSuperAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className={e.suppressedAt ? styles.suppressedRow : ''}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    {formatTs(e.at)}
                  </td>
                  <td>
                    <span className={`${styles.actionBadge} ${ACTION_CLASS[e.action] ?? styles.actionSystem}`}>
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                  </td>
                  <td>
                    <span className={styles.eventId}>{e.actorId}</span>
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.8rem' }}>{e.actorRole}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {e.entity && (
                      <span>
                        {e.entity}
                        {e.entityId && (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}> #{e.entityId.slice(-6)}</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td>
                    {e.suppressedAt ? (
                      <span className={styles.suppressedTag}>suprimido</span>
                    ) : e.details ? (
                      <span className={styles.details} title={JSON.stringify(e.details)}>
                        {JSON.stringify(e.details)}
                      </span>
                    ) : null}
                  </td>
                  {isSuperAdmin && (
                    <td>
                      {!e.suppressedAt && e.action !== 'AUDIT_SUPPRESS' && (
                        <button
                          className={`btn btn-ghost btn-sm ${styles.suppressBtn}`}
                          onClick={() => { setSuppressEvent(e); setSuppressReason(''); setSuppressError(''); }}
                          title="Suprimir evento"
                        >
                          Suprimir
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Suppress modal */}
      {suppressEvent && (
        <div className="modal-overlay" onClick={() => setSuppressEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal__header">
              <span className="modal__title">Suprimir evento de auditoría</span>
              <button className="modal__close" onClick={() => setSuppressEvent(null)}>✕</button>
            </div>
            <div className="modal__body">
              <p style={{ marginBottom: 16, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Esta acción marca el evento como suprimido. El evento original <strong>no se elimina</strong> —
                quedará registrado junto con el motivo de supresión. Esta acción es auditable e irreversible.
              </p>
              <div className="form-group">
                <label className="form-label">Motivo de supresión (opcional)</label>
                <textarea
                  className="form-textarea"
                  value={suppressReason}
                  onChange={(e) => setSuppressReason(e.target.value)}
                  rows={3}
                  placeholder="Indica el motivo de la supresión…"
                />
              </div>
              {suppressError && <div className="alert alert-danger" style={{ marginTop: 12 }}>{suppressError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setSuppressEvent(null)} disabled={suppressSaving}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleSuppress} disabled={suppressSaving}>
                {suppressSaving ? 'Procesando…' : 'Confirmar supresión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
