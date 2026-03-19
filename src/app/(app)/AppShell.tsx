'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { UserRole } from '@/src/lib/types';
import styles from './shell.module.css';

interface Props {
  user: { id: string; name: string; role: UserRole; email: string };
  branch: { id: string; name: string } | null;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬛' },
  { href: '/reservas', label: 'Reservas', icon: '📋' },
  { href: '/contratos', label: 'Contratos', icon: '📄' },
  { href: '/planning', label: 'Planning', icon: '📅' },
  { href: '/entregas', label: 'Entregas', icon: '🚗' },
  { href: '/recogidas', label: 'Recogidas', icon: '🔑' },
  { href: '/vehiculos', label: 'Vehículos', icon: '🚙' },
  { href: '/clientes', label: 'Clientes', icon: '👥' },
  { href: '/gastos', label: 'Gastos', icon: '💶' },
  { href: '/facturacion', label: 'Facturación', icon: '🧾' },
  { href: '/plantillas', label: 'Plantillas', icon: '📝' },
];

const ADMIN_ITEMS = [
  { href: '/tarifas', label: 'Tarifas', icon: '💲' },
  { href: '/gestor', label: 'Gestor', icon: '⚙️' },
  { href: '/auditoria', label: 'Auditoría', icon: '🔍' },
];

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  LECTOR: 'Lector',
};

type Theme = 'light' | 'dark';

export default function AppShell({ user, branch, children }: Props) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('rq-theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('rq-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const showAdminItems = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

  return (
    <div className={styles.shell}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        {/* Logo */}
        <div className={styles.sidebarLogo}>
          <Link href="/dashboard" onClick={() => setSidebarOpen(false)}>
            <img
              src="/brand/logo_RIQ_compl_osc_pq.png"
              alt="RentIQ"
              className={styles.logoImg}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className={styles.logoText}>RentIQ</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          {showAdminItems && (
            <>
              <div className={styles.navDivider} />
              {ADMIN_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div className={styles.sidebarBottom}>
          <div className={styles.sessionInfo}>
            <div className={styles.sessionName}>{user.name}</div>
            <div className={styles.sessionMeta}>
              <span className={styles.roleBadge}>{ROLE_LABELS[user.role]}</span>
              {branch && <span className={styles.branchLabel}>{branch.name}</span>}
            </div>
          </div>
          <div className={styles.bottomActions}>
            <button
              type="button"
              className={styles.themeBtn}
              onClick={toggleTheme}
              title="Cambiar tema"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
            >
              Salir
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={styles.main}>
        {/* Mobile top bar */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <span className={styles.topBarTitle}>RentIQ Gestión</span>
        </div>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
