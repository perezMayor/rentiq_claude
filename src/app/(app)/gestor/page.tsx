'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import type { UserRole, CompanyBranch, CompanySettings } from '@/src/lib/types';
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

type Tab = 'usuarios' | 'sucursales' | 'empresa';

function GestorContent() {
  const [tab, setTab] = useState<Tab>('usuarios');
  const [myRole, setMyRole] = useState<UserRole>('LECTOR');
  const [myUserId, setMyUserId] = useState('');

  // Users tab
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');

  // Branches tab
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState('');

  // Settings tab
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsEdit, setSettingsEdit] = useState<Partial<CompanySettings>>({});

  // User modal
  const [userModal, setUserModal] = useState<'create' | 'edit' | null>(null);
  const [userEdit, setUserEdit] = useState<Partial<SafeUser>>({});
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState('');

  // Branch modal
  const [branchModal, setBranchModal] = useState<'create' | 'edit' | null>(null);
  const [branchEdit, setBranchEdit] = useState<Partial<CompanyBranch>>({});
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchError, setBranchError] = useState('');

  const canWrite = myRole === 'SUPER_ADMIN' || myRole === 'ADMIN';
  const isSuperAdmin = myRole === 'SUPER_ADMIN';

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => {
      setMyRole(d.role ?? 'LECTOR');
      setMyUserId(d.userId ?? d.id ?? '');
    }).catch(() => {});
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const res = await fetch('/api/gestor/usuarios');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setUsers((await res.json()).users ?? []);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Load branches
  const loadBranches = useCallback(async () => {
    setBranchesLoading(true);
    setBranchesError('');
    try {
      const res = await fetch('/api/gestor/sucursales');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      setBranches((await res.json()).branches ?? []);
    } catch (e) {
      setBranchesError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  // Load settings
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const res = await fetch('/api/gestor/empresa');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      const data = await res.json();
      setSettings(data.settings);
      setSettingsEdit(data.settings);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'usuarios') loadUsers();
    else if (tab === 'sucursales') loadBranches();
    else if (tab === 'empresa') loadSettings();
  }, [tab, loadUsers, loadBranches, loadSettings]);

  // ── Users ──

  function openCreateUser() {
    setUserEdit({ role: 'LECTOR', active: true });
    setUserError('');
    setUserModal('create');
  }

  function openEditUser(u: SafeUser) {
    setUserEdit({ ...u });
    setUserError('');
    setUserModal('edit');
  }

  async function saveUser() {
    setUserSaving(true);
    setUserError('');
    try {
      const isEdit = userModal === 'edit';
      const url = isEdit ? `/api/gestor/usuarios/${userEdit.id}` : '/api/gestor/usuarios';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userEdit.name,
          email: userEdit.email,
          role: userEdit.role,
          active: userEdit.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setUserModal(null);
      await loadUsers();
    } catch (e) {
      setUserError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setUserSaving(false);
    }
  }

  async function toggleUserActive(u: SafeUser) {
    if (!confirm(`${u.active ? 'Desactivar' : 'Activar'} usuario ${u.name}?`)) return;
    try {
      const res = await fetch(`/api/gestor/usuarios/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !u.active }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Error');
        return;
      }
      await loadUsers();
    } catch {
      alert('Error de red');
    }
  }

  async function deleteUser(u: SafeUser) {
    if (!confirm(`¿Eliminar permanentemente el usuario ${u.name}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/gestor/usuarios/${u.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? 'Error');
        return;
      }
      await loadUsers();
    } catch {
      alert('Error de red');
    }
  }

  // ── Branches ──

  function openCreateBranch() {
    setBranchEdit({ active: true });
    setBranchError('');
    setBranchModal('create');
  }

  function openEditBranch(b: CompanyBranch) {
    setBranchEdit({ ...b });
    setBranchError('');
    setBranchModal('edit');
  }

  async function saveBranch() {
    setBranchSaving(true);
    setBranchError('');
    try {
      const isEdit = branchModal === 'edit';
      const url = isEdit ? `/api/gestor/sucursales/${branchEdit.id}` : '/api/gestor/sucursales';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: branchEdit.name,
          address: branchEdit.address,
          phone: branchEdit.phone,
          email: branchEdit.email,
          contractPrefix: branchEdit.contractPrefix,
          active: branchEdit.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setBranchModal(null);
      await loadBranches();
    } catch (e) {
      setBranchError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBranchSaving(false);
    }
  }

  // ── Settings ──

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSuccess(false);
    try {
      const res = await fetch('/api/gestor/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsEdit),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setSettings(data.settings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestor</h1>
          <p className="page-subtitle">Administración del sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['usuarios', 'sucursales', 'empresa'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'usuarios' ? 'Usuarios' : t === 'sucursales' ? 'Sucursales' : 'Empresa'}
          </button>
        ))}
      </div>

      {/* ── Usuarios tab ── */}
      {tab === 'usuarios' && (
        <div>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div />
            {canWrite && (
              <button className="btn btn-primary" onClick={openCreateUser}>+ Nuevo usuario</button>
            )}
          </div>
          {usersError && <div className="alert alert-danger">{usersError}</div>}
          <div className="table-wrapper">
            {usersLoading ? (
              <div className={styles.loadingRow}>Cargando usuarios…</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    {canWrite && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td className="text-muted">{u.email}</td>
                      <td>
                        <span className={`${styles.roleTag} ${ROLE_CLASS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td>
                        <span className={styles.dot} style={{
                          background: u.active ? 'var(--color-status-contratado)' : 'var(--color-status-no-disponible)'
                        }} />
                        {u.active ? 'Activo' : 'Inactivo'}
                      </td>
                      {canWrite && (
                        <td>
                          <div className={styles.actions}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditUser(u)}
                              disabled={!canWrite}
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => toggleUserActive(u)}
                              disabled={u.id === myUserId}
                            >
                              {u.active ? 'Desactivar' : 'Activar'}
                            </button>
                            {isSuperAdmin && u.id !== myUserId && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => deleteUser(u)}
                                style={{ color: 'var(--color-danger)' }}
                              >
                                Eliminar
                              </button>
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

      {/* ── Sucursales tab ── */}
      {tab === 'sucursales' && (
        <div>
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div />
            {canWrite && (
              <button className="btn btn-primary" onClick={openCreateBranch}>+ Nueva sucursal</button>
            )}
          </div>
          {branchesError && <div className="alert alert-danger">{branchesError}</div>}
          <div className="table-wrapper">
            {branchesLoading ? (
              <div className={styles.loadingRow}>Cargando sucursales…</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Prefijo</th>
                    <th>Dirección</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    {canWrite && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500 }}>{b.name}</td>
                      <td>
                        <code style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                          {b.contractPrefix}
                        </code>
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>{b.address}</td>
                      <td className="text-muted">{b.phone}</td>
                      <td>
                        <span className={styles.dot} style={{
                          background: b.active ? 'var(--color-status-contratado)' : 'var(--color-status-no-disponible)'
                        }} />
                        {b.active ? 'Activa' : 'Inactiva'}
                      </td>
                      {canWrite && (
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditBranch(b)}>
                            Editar
                          </button>
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

      {/* ── Empresa tab ── */}
      {tab === 'empresa' && (
        <div className={styles.settingsForm}>
          {settingsLoading && <div className={styles.loadingRow}>Cargando configuración…</div>}
          {settingsError && <div className="alert alert-danger">{settingsError}</div>}
          {settingsSuccess && <div className="alert alert-info">Configuración guardada correctamente.</div>}
          {settings && (
            <>
              <div className={styles.settingsGrid}>
                <div className="form-group">
                  <label className="form-label">Nombre empresa *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsEdit.name ?? ''}
                    onChange={(e) => setSettingsEdit((s) => ({ ...s, name: e.target.value }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">NIF</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsEdit.nif ?? ''}
                    onChange={(e) => setSettingsEdit((s) => ({ ...s, nif: e.target.value }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Dirección</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsEdit.address ?? ''}
                    onChange={(e) => setSettingsEdit((s) => ({ ...s, address: e.target.value }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsEdit.phone ?? ''}
                    onChange={(e) => setSettingsEdit((s) => ({ ...s, phone: e.target.value }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={settingsEdit.email ?? ''}
                    onChange={(e) => setSettingsEdit((s) => ({ ...s, email: e.target.value }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Serie de facturas</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsEdit.invoiceSeries ?? ''}
                    onChange={(e) => setSettingsEdit((s) => ({ ...s, invoiceSeries: e.target.value }))}
                    disabled={!isSuperAdmin}
                    maxLength={3}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IVA (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settingsEdit.ivaPercent ?? ''}
                    onChange={(e) => setSettingsEdit((s) => ({ ...s, ivaPercent: parseFloat(e.target.value) }))}
                    disabled={!isSuperAdmin}
                  />
                </div>
              </div>
              {isSuperAdmin && (
                <button
                  className="btn btn-primary"
                  onClick={saveSettings}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'Guardando…' : 'Guardar configuración'}
                </button>
              )}
              {!isSuperAdmin && (
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Solo SUPER_ADMIN puede modificar la configuración de empresa.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── User modal ── */}
      {userModal && (
        <div className="modal-overlay" onClick={() => setUserModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">
                {userModal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
              </span>
              <button className="modal__close" onClick={() => setUserModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={userEdit.name ?? ''}
                    onChange={(e) => setUserEdit((u) => ({ ...u, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={userEdit.email ?? ''}
                    onChange={(e) => setUserEdit((u) => ({ ...u, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol *</label>
                  <select
                    className="form-select"
                    value={userEdit.role ?? 'LECTOR'}
                    onChange={(e) => setUserEdit((u) => ({ ...u, role: e.target.value as UserRole }))}
                  >
                    {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                    <option value="ADMIN">Admin</option>
                    <option value="LECTOR">Lector</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={userEdit.active ? 'true' : 'false'}
                    onChange={(e) => setUserEdit((u) => ({ ...u, active: e.target.value === 'true' }))}
                    disabled={userEdit.id === myUserId}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              {userError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{userError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setUserModal(null)} disabled={userSaving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveUser} disabled={userSaving}>
                {userSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Branch modal ── */}
      {branchModal && (
        <div className="modal-overlay" onClick={() => setBranchModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">
                {branchModal === 'create' ? 'Nueva sucursal' : 'Editar sucursal'}
              </span>
              <button className="modal__close" onClick={() => setBranchModal(null)}>✕</button>
            </div>
            <div className="modal__body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={branchEdit.name ?? ''}
                    onChange={(e) => setBranchEdit((b) => ({ ...b, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Prefijo de contrato *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={branchEdit.contractPrefix ?? ''}
                    onChange={(e) => setBranchEdit((b) => ({ ...b, contractPrefix: e.target.value.toUpperCase() }))}
                    maxLength={6}
                    disabled={branchModal === 'edit'}
                    placeholder="MAD"
                  />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Dirección *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={branchEdit.address ?? ''}
                    onChange={(e) => setBranchEdit((b) => ({ ...b, address: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={branchEdit.phone ?? ''}
                    onChange={(e) => setBranchEdit((b) => ({ ...b, phone: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={branchEdit.email ?? ''}
                    onChange={(e) => setBranchEdit((b) => ({ ...b, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    className="form-select"
                    value={branchEdit.active ? 'true' : 'false'}
                    onChange={(e) => setBranchEdit((b) => ({ ...b, active: e.target.value === 'true' }))}
                  >
                    <option value="true">Activa</option>
                    <option value="false">Inactiva</option>
                  </select>
                </div>
              </div>
              {branchError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{branchError}</div>}
            </div>
            <div className="modal__footer">
              <button className="btn btn-ghost" onClick={() => setBranchModal(null)} disabled={branchSaving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveBranch} disabled={branchSaving}>
                {branchSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab wrapper ──────────────────────────────────────────────────────────

const GESTOR_TABS = [
  { key: 'gestion',    label: 'Usuarios y Sucursales' },
  { key: 'tarifas',    label: 'Tarifas' },
  { key: 'plantillas', label: 'Plantillas' },
  { key: 'backups',    label: 'Backups' },
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
        <button key={t.key} type="button" onClick={() => go(t.key)} style={{ flex: 1, textAlign: 'center', padding: '7px 8px', fontSize: '0.82rem', fontWeight: active === t.key ? 600 : 500, color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)', background: active === t.key ? 'var(--color-surface-strong)' : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', whiteSpace: 'nowrap' }}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function GestorInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'gestion';

  return (
    <div>
      <GestorTabNav active={tab} />
      {tab === 'gestion' && <GestorContent />}
      {tab !== 'gestion' && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-state__icon">🚧</div>
          <div className="empty-state__text">{GESTOR_TABS.find((t) => t.key === tab)?.label ?? tab} — Próximamente</div>
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
