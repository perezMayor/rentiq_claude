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

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  dashboard:   'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  reservas:    'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  contratos:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  vehiculos:   'M19 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h11l4 4v4a2 2 0 0 1-2 2z M7.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M16.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  clientes:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  gastos:      'M9 14l6 0 M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M12 6v2 M12 16v2 M6 12h2 M16 12h2',
  facturacion: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 M9 14h6 M9 18h4',
  tarifas:     'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01',
  gestor:      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  ayuda:       'M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
  config:      'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
};

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',    icon: 'dashboard'   as const },
  { href: '/reservas',    label: 'Reservas',     icon: 'reservas'    as const },
  { href: '/contratos',   label: 'Contratos',    icon: 'contratos'   as const },
  { href: '/vehiculos',   label: 'Vehículos',    icon: 'vehiculos'   as const },
  { href: '/clientes',    label: 'Clientes',     icon: 'clientes'    as const },
  { href: '/facturacion', label: 'Facturación',  icon: 'facturacion' as const },
  { href: '/tarifas',     label: 'Tarifas',      icon: 'tarifas'     as const },
] as const;

const ADMIN_ITEMS = [
  { href: '/gestor', label: 'Gestor', icon: 'gestor' as const },
] as const;

const BOTTOM_ITEMS = [
  { href: '/ayuda',         label: 'Ayuda',          icon: 'ayuda'   as const },
  { href: '/configuracion', label: 'Configuración',  icon: 'config'  as const },
] as const;

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
        {/* Logo — full width, no text */}
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
          </Link>
        </div>

        {/* Main nav */}
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon}>
                <Icon d={ICONS[item.icon]} />
              </span>
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
                  <span className={styles.navIcon}>
                    <Icon d={ICONS[item.icon]} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}

          <div className={styles.navDivider} />

          {BOTTOM_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon}>
                <Icon d={ICONS[item.icon]} />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className={styles.sidebarBottom}>
          <div className={styles.sessionInfo}>
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
              {theme === 'light' ? (
                <Icon d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              ) : (
                <Icon d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z" />
              )}
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
            <Icon d="M3 12h18M3 6h18M3 18h18" />
          </button>
          <span className={styles.topBarTitle}>RentIQ Gestión</span>
        </div>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
