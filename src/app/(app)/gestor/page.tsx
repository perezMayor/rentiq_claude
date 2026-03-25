'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import type { UserRole, CompanyBranch } from '@/src/lib/types';
import TarifasPage from '@/src/app/(app)/tarifas/page';
import styles from './gestor.module.css';

type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  LECTOR: 'Lector',
};

const ROLE_CLASS: Record<UserRole, string> = {
  SUPER_ADMIN: styles.roleSuperAdmin,
  ADMIN: styles.roleAdmin,
  LECTOR: styles.roleLector,
};

// ─── Config. operativa ────────────────────────────────────────────────────────

function ConfigOperativaTab({ myRole }: { myRole: UserRole }) {
  const isSuperAdmin = myRole === 'SUPER_ADMIN';

  const [graceHours, setGraceHours] = useState('');
  const [overlapMinHours, setOverlapMinHours] = useState('');
  const [dayChangeCutoffHour, setDayChangeCutoffHour] = useState('');
  const [minReservationDays, setMinReservationDays] = useState('');
  const [minAdvanceHours, setMinAdvanceHours] = useState('');
  const [quoteValidityDays, setQuoteValidityDays] = useState('');
  const [defaultDeposit, setDefaultDeposit] = useState('');
  const [nightFeeFromHour, setNightFeeFromHour] = useState('');
  const [nightFeeToHour, setNightFeeToHour] = useState('');
  const [nightFeePrice, setNightFeePrice] = useState('');
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgError, setCfgError] = useState('');
  const [cfgOk, setCfgOk] = useState(false);

  const loadConfig = useCallback(async () => {
    setCfgLoading(true); setCfgError('');
    try {
      const res = await fetch('/api/gestor/empresa');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      const s = (await res.json()).settings ?? {};
      const str = (v: unknown) => v != null ? String(v) : '';
      setGraceHours(str(s.graceHours));
      setOverlapMinHours(str(s.overlapMinHours));
      setDayChangeCutoffHour(str(s.dayChangeCutoffHour));
      setMinReservationDays(str(s.minReservationDays));
      setMinAdvanceHours(str(s.minAdvanceHours));
      setQuoteValidityDays(str(s.quoteValidityDays));
      setDefaultDeposit(str(s.defaultDeposit));
      setNightFeeFromHour(str(s.nightFeeFromHour));
      setNightFeeToHour(str(s.nightFeeToHour));
      setNightFeePrice(str(s.nightFeePrice));
    } catch (e) { setCfgError(e instanceof Error ? e.message : 'Error'); }
    finally { setCfgLoading(false); }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function saveConfig() {
    setCfgSaving(true); setCfgError(''); setCfgOk(false);
    try {
      function numOrNull(v: string) { const n = parseFloat(v); return v === '' ? null : isNaN(n) ? null : n; }
      const body = {
        graceHours:           numOrNull(graceHours),
        overlapMinHours:      numOrNull(overlapMinHours),
        dayChangeCutoffHour:  numOrNull(dayChangeCutoffHour),
        minReservationDays:   numOrNull(minReservationDays),
        minAdvanceHours:      numOrNull(minAdvanceHours),
        quoteValidityDays:    numOrNull(quoteValidityDays),
        defaultDeposit:       numOrNull(defaultDeposit),
        nightFeeFromHour:     numOrNull(nightFeeFromHour),
        nightFeeToHour:       numOrNull(nightFeeToHour),
        nightFeePrice:        numOrNull(nightFeePrice),
      };
      const res = await fetch('/api/gestor/empresa', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      const s = data.settings ?? {};
      const str = (v: unknown) => v != null ? String(v) : '';
      setGraceHours(str(s.graceHours)); setOverlapMinHours(str(s.overlapMinHours));
      setDayChangeCutoffHour(str(s.dayChangeCutoffHour)); setMinReservationDays(str(s.minReservationDays));
      setMinAdvanceHours(str(s.minAdvanceHours)); setQuoteValidityDays(str(s.quoteValidityDays));
      setDefaultDeposit(str(s.defaultDeposit));
      setNightFeeFromHour(str(s.nightFeeFromHour)); setNightFeeToHour(str(s.nightFeeToHour)); setNightFeePrice(str(s.nightFeePrice));
      setCfgOk(true);
      setTimeout(() => setCfgOk(false), 3000);
    } catch (e) { setCfgError(e instanceof Error ? e.message : 'Error'); }
    finally { setCfgSaving(false); }
  }

  if (cfgLoading) return <div className={styles.loadingRow}>Cargando…</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      {cfgError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{cfgError}</div>}
      {cfgOk && <div className="alert alert-success" style={{ marginBottom: 16 }}>Configuración guardada</div>}

      {/* Reservas */}
      <div className={styles.cfgSection}>
        <div className={styles.cfgSectionTitle}>Reservas</div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="form-group">
            <label className="form-label">Días mínimos de reserva</label>
            <input type="number" className="form-input" value={minReservationDays} min={1} step={1} placeholder="Sin mínimo" disabled={!isSuperAdmin} onChange={(e) => setMinReservationDays(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Antelación mínima (horas)</label>
            <input type="number" className="form-input" value={minAdvanceHours} min={0} step={1} placeholder="Sin límite" disabled={!isSuperAdmin} onChange={(e) => setMinAdvanceHours(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Presupuestos y contratos */}
      <div className={styles.cfgSection}>
        <div className={styles.cfgSectionTitle}>Presupuestos y contratos</div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="form-group">
            <label className="form-label">Validez del presupuesto (días)</label>
            <input type="number" className="form-input" value={quoteValidityDays} min={1} step={1} placeholder="Sin caducidad" disabled={!isSuperAdmin} onChange={(e) => setQuoteValidityDays(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Depósito por defecto (€)</label>
            <input type="number" className="form-input" value={defaultDeposit} min={0} step={0.01} placeholder="0.00" disabled={!isSuperAdmin} onChange={(e) => setDefaultDeposit(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Cálculo de días */}
      <div className={styles.cfgSection}>
        <div className={styles.cfgSectionTitle}>Cálculo de días</div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="form-group">
            <label className="form-label">Hora de corte de día (0–23)</label>
            <input type="number" className="form-input" value={dayChangeCutoffHour} min={0} max={23} step={1} placeholder="Sin corte" disabled={!isSuperAdmin} onChange={(e) => setDayChangeCutoffHour(e.target.value)} />
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>Entregas/recogidas después de esta hora cuentan como día siguiente.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Período de cortesía (horas)</label>
            <input type="number" className="form-input" value={graceHours} min={0} max={72} step={1} placeholder="Sin cortesía" disabled={!isSuperAdmin} onChange={(e) => setGraceHours(e.target.value)} />
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>Horas de exceso a partir de las cuales se suma un día adicional al precio.</p>
          </div>
          <div className="form-group">
            <label className="form-label">Tiempo de solape en planning (horas)</label>
            <input type="number" className="form-input" value={overlapMinHours} min={0} max={48} step={1} placeholder="2" disabled={!isSuperAdmin} onChange={(e) => setOverlapMinHours(e.target.value)} />
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>Margen mínimo entre fin de una reserva e inicio de la siguiente antes de marcarla como solape en el planning.</p>
          </div>
        </div>
      </div>

      {/* Tarifa nocturna */}
      <div className={styles.cfgSection}>
        <div className={styles.cfgSectionTitle}>Tarifa nocturna</div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="form-group">
            <label className="form-label">Hora de inicio (0–23)</label>
            <input type="number" className="form-input" value={nightFeeFromHour} min={0} max={23} step={1} placeholder="Ej: 22" disabled={!isSuperAdmin} onChange={(e) => setNightFeeFromHour(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Hora de fin (0–23)</label>
            <input type="number" className="form-input" value={nightFeeToHour} min={0} max={23} step={1} placeholder="Ej: 8" disabled={!isSuperAdmin} onChange={(e) => setNightFeeToHour(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Precio tarifa nocturna (€)</label>
            <input type="number" className="form-input" value={nightFeePrice} min={0} step={0.01} placeholder="0.00 — vacío = no aplica" disabled={!isSuperAdmin} onChange={(e) => setNightFeePrice(e.target.value)} />
            <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>Recargo aplicable a entregas y recogidas fuera del horario habitual. Dejar vacío para desactivar.</p>
          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" onClick={saveConfig} disabled={cfgSaving}>
            {cfgSaving ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Usuarios y Sucursales ────────────────────────────────────────────────────

type InnerTab = 'usuarios' | 'sucursales' | 'lugares';

function UsuariosYSucursalesTab({ myRole, myUserId }: { myRole: UserRole; myUserId: string }) {
  const [innerTab, setInnerTab] = useState<InnerTab>('usuarios');

  const canWrite = myRole === 'SUPER_ADMIN' || myRole === 'ADMIN';
  const isSuperAdmin = myRole === 'SUPER_ADMIN';

  // Users
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [userModal, setUserModal] = useState<'create' | 'edit' | null>(null);
  const [userEdit, setUserEdit] = useState<Partial<SafeUser>>({});
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState('');

  // Branches
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState('');
  const [branchModal, setBranchModal] = useState<'create' | 'edit' | null>(null);
  const [branchEdit, setBranchEdit] = useState<Partial<CompanyBranch>>({});
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchError, setBranchError] = useState('');

  // Locations
  const [locations, setLocations] = useState<string[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState('');
  const [locSaving, setLocSaving] = useState(false);
  const [newLoc, setNewLoc] = useState('');

  const loadUsers = useCallback(async () => {
    setUsersLoading(true); setUsersError('');
    try {
      const res = await fetch('/api/gestor/usuarios');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setUsers((await res.json()).users ?? []);
    } catch (e) { setUsersError(e instanceof Error ? e.message : 'Error'); }
    finally { setUsersLoading(false); }
  }, []);

  const loadBranches = useCallback(async () => {
    setBranchesLoading(true); setBranchesError('');
    try {
      const res = await fetch('/api/gestor/sucursales');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setBranches((await res.json()).branches ?? []);
    } catch (e) { setBranchesError(e instanceof Error ? e.message : 'Error'); }
    finally { setBranchesLoading(false); }
  }, []);

  const loadLocations = useCallback(async () => {
    setLocLoading(true); setLocError('');
    try {
      const res = await fetch('/api/gestor/empresa');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setLocations((await res.json()).settings?.deliveryLocations ?? []);
    } catch (e) { setLocError(e instanceof Error ? e.message : 'Error'); }
    finally { setLocLoading(false); }
  }, []);

  async function persistLocations(updated: string[]) {
    setLocSaving(true); setLocError('');
    try {
      const res = await fetch('/api/gestor/empresa', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryLocations: updated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setLocations(data.settings?.deliveryLocations ?? updated);
    } catch (e) { setLocError(e instanceof Error ? e.message : 'Error'); }
    finally { setLocSaving(false); }
  }

  function handleAddLoc() {
    const trimmed = newLoc.trim();
    if (!trimmed || locations.includes(trimmed)) return;
    const updated = [...locations, trimmed];
    setLocations(updated);
    setNewLoc('');
    persistLocations(updated);
  }

  function handleRemoveLoc(loc: string) {
    const updated = locations.filter((l) => l !== loc);
    setLocations(updated);
    persistLocations(updated);
  }

  useEffect(() => {
    if (innerTab === 'usuarios') loadUsers();
    else if (innerTab === 'sucursales') loadBranches();
    else if (innerTab === 'lugares') loadLocations();
  }, [innerTab, loadUsers, loadBranches, loadLocations]);

  async function saveUser() {
    setUserSaving(true); setUserError('');
    try {
      const isEdit = userModal === 'edit';
      const res = await fetch(isEdit ? `/api/gestor/usuarios/${userEdit.id}` : '/api/gestor/usuarios', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userEdit.name, email: userEdit.email, role: userEdit.role, active: userEdit.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setUserModal(null);
      await loadUsers();
    } catch (e) { setUserError(e instanceof Error ? e.message : 'Error'); }
    finally { setUserSaving(false); }
  }

  async function toggleUserActive(u: SafeUser) {
    if (!confirm(`${u.active ? 'Desactivar' : 'Activar'} usuario ${u.name}?`)) return;
    try {
      const res = await fetch(`/api/gestor/usuarios/${u.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !u.active }),
      });
      if (!res.ok) { alert((await res.json()).error ?? 'Error'); return; }
      await loadUsers();
    } catch { alert('Error de red'); }
  }

  async function deleteUser(u: SafeUser) {
    if (!confirm(`¿Eliminar permanentemente el usuario ${u.name}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/gestor/usuarios/${u.id}`, { method: 'DELETE' });
      if (!res.ok) { alert((await res.json()).error ?? 'Error'); return; }
      await loadUsers();
    } catch { alert('Error de red'); }
  }

  async function saveBranch() {
    setBranchSaving(true); setBranchError('');
    try {
      const isEdit = branchModal === 'edit';
      const res = await fetch(isEdit ? `/api/gestor/sucursales/${branchEdit.id}` : '/api/gestor/sucursales', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: branchEdit.name, address: branchEdit.address, phone: branchEdit.phone, email: branchEdit.email, contractPrefix: branchEdit.contractPrefix, invoicePrefix: branchEdit.invoicePrefix, active: branchEdit.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setBranchModal(null);
      await loadBranches();
    } catch (e) { setBranchError(e instanceof Error ? e.message : 'Error'); }
    finally { setBranchSaving(false); }
  }

  return (
    <div>
      {/* Inner tabs */}
      <div className={styles.tabs}>
        {(['usuarios', 'sucursales', 'lugares'] as InnerTab[]).map((t) => (
          <button key={t} className={`${styles.tab} ${innerTab === t ? styles.tabActive : ''}`} onClick={() => setInnerTab(t)}>
            {t === 'usuarios' ? 'Usuarios' : t === 'sucursales' ? 'Sucursales' : 'Lugares de entrega'}
          </button>
        ))}
      </div>

      {/* ── Usuarios ── */}
      {innerTab === 'usuarios' && (
        <div>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div />
            {canWrite && <button className="btn btn-primary" onClick={() => { setUserEdit({ role: 'LECTOR', active: true }); setUserError(''); setUserModal('create'); }}>+ Nuevo usuario</button>}
          </div>
          {usersError && <div className="alert alert-danger">{usersError}</div>}
          <div className="table-wrapper">
            {usersLoading ? <div className={styles.loadingRow}>Cargando usuarios…</div> : (
              <table className="data-table">
                <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th>{canWrite && <th>Acciones</th>}</tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td className="text-muted">{u.email}</td>
                      <td><span className={`${styles.roleTag} ${ROLE_CLASS[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                      <td>
                        <span className={styles.dot} style={{ background: u.active ? 'var(--color-status-contratado)' : 'var(--color-status-no-disponible)' }} />
                        {u.active ? 'Activo' : 'Inactivo'}
                      </td>
                      {canWrite && (
                        <td>
                          <div className={styles.actions}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setUserEdit({ ...u }); setUserError(''); setUserModal('edit'); }}>Editar</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleUserActive(u)} disabled={u.id === myUserId}>{u.active ? 'Desactivar' : 'Activar'}</button>
                            {isSuperAdmin && u.id !== myUserId && (
                              <button className="btn btn-ghost btn-sm" onClick={() => deleteUser(u)} style={{ color: 'var(--color-danger)' }}>Eliminar</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Sucursales ── */}
      {innerTab === 'sucursales' && (
        <div>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div />
            {canWrite && <button className="btn btn-primary" onClick={() => { setBranchEdit({ active: true }); setBranchError(''); setBranchModal('create'); }}>+ Nueva sucursal</button>}
          </div>
          {branchesError && <div className="alert alert-danger">{branchesError}</div>}
          <div className="table-wrapper">
            {branchesLoading ? <div className={styles.loadingRow}>Cargando sucursales…</div> : (
              <table className="data-table">
                <thead><tr><th>Nombre</th><th>Prefijo</th><th>Dirección</th><th>Teléfono</th><th>Estado</th>{canWrite && <th>Acciones</th>}</tr></thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500 }}>{b.name}</td>
                      <td><code style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>{b.contractPrefix}</code></td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>{b.address}</td>
                      <td className="text-muted">{b.phone}</td>
                      <td>
                        <span className={styles.dot} style={{ background: b.active ? 'var(--color-status-contratado)' : 'var(--color-status-no-disponible)' }} />
                        {b.active ? 'Activa' : 'Inactiva'}
                      </td>
                      {canWrite && <td><button className="btn btn-ghost btn-sm" onClick={() => { setBranchEdit({ ...b }); setBranchError(''); setBranchModal('edit'); }}>Editar</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Lugares de entrega ── */}
      {innerTab === 'lugares' && (
        <div style={{ maxWidth: 560 }}>
          {locError && <div className="alert alert-danger">{locError}</div>}
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            Define los lugares de entrega y recogida disponibles. Aparecerán como sugerencias en reservas y contratos, pero el campo también admite texto libre.
          </p>
          {canWrite && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                type="text"
                className="form-input"
                value={newLoc}
                onChange={(e) => setNewLoc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLoc(); } }}
                placeholder="Ej: Aeropuerto T1, Estación de tren, Oficina central…"
                disabled={locSaving}
              />
              <button type="button" className="btn btn-primary" onClick={handleAddLoc} disabled={locSaving || !newLoc.trim()} style={{ whiteSpace: 'nowrap' }}>
                + Añadir
              </button>
            </div>
          )}
          {locLoading ? (
            <div className={styles.loadingRow}>Cargando lugares…</div>
          ) : locations.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state__icon">📍</div>
              <div className="empty-state__text">No hay lugares configurados</div>
            </div>
          ) : (
            <div className={styles.locationList}>
              {locations.map((loc) => (
                <div key={loc} className={styles.locationRow}>
                  <span className={styles.locationName}>📍 {loc}</span>
                  {canWrite && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveLoc(loc)} disabled={locSaving} style={{ color: 'var(--color-danger)', borderColor: 'transparent' }}>
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {locSaving && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 12 }}>Guardando…</p>}
        </div>
      )}


      {/* ── User modal ── */}
      {userModal && (
        <div className="modal-overlay" onClick={() => setUserModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">{userModal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</span>
              <button className="modal__close" onClick={() => setUserModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input type="text" className="form-input" value={userEdit.name ?? ''} onChange={(e) => setUserEdit((u) => ({ ...u, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-input" value={userEdit.email ?? ''} onChange={(e) => setUserEdit((u) => ({ ...u, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol *</label>
                  <select className="form-select" value={userEdit.role ?? 'LECTOR'} onChange={(e) => setUserEdit((u) => ({ ...u, role: e.target.value as UserRole }))}>
                    {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                    <option value="ADMIN">Admin</option>
                    <option value="LECTOR">Lector</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={userEdit.active ? 'true' : 'false'} onChange={(e) => setUserEdit((u) => ({ ...u, active: e.target.value === 'true' }))} disabled={userEdit.id === myUserId}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              {userError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{userError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setUserModal(null)} disabled={userSaving}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveUser} disabled={userSaving}>{userSaving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Branch modal ── */}
      {branchModal && (
        <div className="modal-overlay" onClick={() => setBranchModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">{branchModal === 'create' ? 'Nueva sucursal' : 'Editar sucursal'}</span>
              <button className="modal__close" onClick={() => setBranchModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input type="text" className="form-input" value={branchEdit.name ?? ''} onChange={(e) => setBranchEdit((b) => ({ ...b, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prefijo de contrato *</label>
                  <input type="text" className="form-input" value={branchEdit.contractPrefix ?? ''} onChange={(e) => setBranchEdit((b) => ({ ...b, contractPrefix: e.target.value.toUpperCase() }))} maxLength={6} disabled={branchModal === 'edit'} placeholder="MAD" />
                </div>
                <div className="form-group">
                  <label className="form-label">Serie facturas</label>
                  <input
                    type="text"
                    className="form-input"
                    value={branchEdit.invoicePrefix ?? ''}
                    onChange={(e) => setBranchEdit((b) => ({ ...b, invoicePrefix: e.target.value.toUpperCase() }))}
                    maxLength={6}
                    placeholder={branchEdit.contractPrefix ?? 'Igual que contratos'}
                  />
                  <p style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>Prefijo de facturas. Vacío = usa serie de contratos.</p>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Dirección *</label>
                  <input type="text" className="form-input" value={branchEdit.address ?? ''} onChange={(e) => setBranchEdit((b) => ({ ...b, address: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono *</label>
                  <input type="text" className="form-input" value={branchEdit.phone ?? ''} onChange={(e) => setBranchEdit((b) => ({ ...b, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-input" value={branchEdit.email ?? ''} onChange={(e) => setBranchEdit((b) => ({ ...b, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={branchEdit.active ? 'true' : 'false'} onChange={(e) => setBranchEdit((b) => ({ ...b, active: e.target.value === 'true' }))}>
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
              </div>
              {branchError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{branchError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setBranchModal(null)} disabled={branchSaving}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveBranch} disabled={branchSaving}>{branchSaving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Canales de venta ─────────────────────────────────────────────────────────

interface SalesChannel { id: string; name: string; code: string; commissionPercent: number; active: boolean; createdAt: string; }

function CanalesTab({ myRole }: { myRole: UserRole }) {
  const canWriteRole = myRole === 'SUPER_ADMIN' || myRole === 'ADMIN';

  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [edit, setEdit] = useState<Partial<SalesChannel>>({});
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/canales');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setChannels((await res.json()).channels ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setModalError('');
    try {
      const isEdit = modal === 'edit';
      const res = await fetch(isEdit ? `/api/canales/${edit.id}` : '/api/canales', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: edit.name, code: edit.code, active: edit.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setModal(null);
      await load();
    } catch (e) { setModalError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function toggleActive(ch: SalesChannel) {
    try {
      const res = await fetch(`/api/canales/${ch.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !ch.active }),
      });
      if (!res.ok) { alert((await res.json()).error ?? 'Error'); return; }
      await load();
    } catch { alert('Error de red'); }
  }

  async function deleteChannel(ch: SalesChannel) {
    if (!confirm(`¿Eliminar el canal "${ch.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/canales/${ch.id}`, { method: 'DELETE' });
      if (!res.ok) { alert((await res.json()).error ?? 'Error'); return; }
      await load();
    } catch { alert('Error de red'); }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div />
        {canWriteRole && (
          <button className="btn btn-primary" onClick={() => { setEdit({ active: true }); setModalError(''); setModal('create'); }}>
            + Nuevo canal
          </button>
        )}
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="table-wrapper">
        {loading ? <div className={styles.loadingRow}>Cargando canales…</div> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Estado</th>
                {canWriteRole && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>No hay canales configurados</td></tr>
              ) : channels.map((ch) => (
                <tr key={ch.id}>
                  <td style={{ fontWeight: 500 }}>{ch.name}</td>
                  <td><code style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>{ch.code}</code></td>
                  <td>
                    <span className={styles.dot} style={{ background: ch.active ? 'var(--color-status-contratado)' : 'var(--color-status-no-disponible)' }} />
                    {ch.active ? 'Activo' : 'Inactivo'}
                  </td>
                  {canWriteRole && (
                    <td>
                      <div className={styles.actions}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEdit({ ...ch }); setModalError(''); setModal('edit'); }}>Editar</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(ch)}>{ch.active ? 'Desactivar' : 'Activar'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteChannel(ch)} style={{ color: 'var(--color-danger)' }}>Eliminar</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">{modal === 'create' ? 'Nuevo canal de venta' : 'Editar canal'}</span>
              <button className="modal__close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input type="text" className="form-input" value={edit.name ?? ''} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input type="text" className="form-input" value={edit.code ?? ''} onChange={(e) => setEdit((s) => ({ ...s, code: e.target.value.toUpperCase() }))} maxLength={6} disabled={modal === 'edit'} placeholder="DIR" />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={edit.active ? 'true' : 'false'} onChange={(e) => setEdit((s) => ({ ...s, active: e.target.value === 'true' }))}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              {modalError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{modalError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab nav (top level) ──────────────────────────────────────────────────────

const GESTOR_TABS = [
  { key: 'gestion',       label: 'Usuarios y Sucursales' },
  { key: 'canales',       label: 'Canales de venta' },
  { key: 'tarifas',       label: 'Tarifas' },
  { key: 'config',        label: 'Config. operativa' },
  { key: 'plantillas',    label: 'Plantillas' },
  { key: 'backups',       label: 'Backups' },
];

function GestorTabNav({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(key: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 24 }}>
      {GESTOR_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => go(t.key)}
          style={{
            flex: 1, textAlign: 'center', padding: '6px 8px', fontSize: '0.82rem',
            fontWeight: active === t.key ? 600 : 500,
            color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
            background: active === t.key ? 'var(--color-surface-strong)' : 'transparent',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function GestorInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'gestion';

  const [myRole, setMyRole] = useState<UserRole>('LECTOR');
  const [myUserId, setMyUserId] = useState('');

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => {
      setMyRole(d.role ?? 'LECTOR');
      setMyUserId(d.userId ?? d.id ?? '');
    }).catch(() => {});
  }, []);

  const tabLabel = GESTOR_TABS.find((t) => t.key === tab)?.label ?? tab;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestor</h1>
          <p className="page-subtitle">{tabLabel}</p>
        </div>
      </div>
      <GestorTabNav active={tab} />

      {tab === 'gestion'       && <UsuariosYSucursalesTab myRole={myRole} myUserId={myUserId} />}
      {tab === 'canales'       && <CanalesTab myRole={myRole} />}
      {tab === 'tarifas'       && <TarifasPage />}
      {tab === 'config'        && <ConfigOperativaTab myRole={myRole} />}
      {(tab === 'plantillas' || tab === 'backups') && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-state__icon">🚧</div>
          <div className="empty-state__text">{tabLabel} — Próximamente</div>
        </div>
      )}
    </div>
  );
}

export default function GestorPage() {
  return (
    <Suspense>
      <GestorInner />
    </Suspense>
  );
}
