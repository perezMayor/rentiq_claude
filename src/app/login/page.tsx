'use client';

import { useState } from 'react';
import styles from './login.module.css';

const DEMO_MODE = process.env.NEXT_PUBLIC_RENTIQ_DEMO_MODE === 'true';

const DEMO_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Acceso completo al sistema' },
  { value: 'ADMIN', label: 'Administrador', description: 'Gestión operativa completa' },
  { value: 'LECTOR', label: 'Lector', description: 'Solo lectura' },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDemoLogin(role: string) {
    setLoading(true);
    setError('');
    const fd = new FormData();
    fd.append('role', role);
    const res = await fetch('/api/login', { method: 'POST', body: fd, redirect: 'follow' });
    if (res.ok || res.redirected) {
      window.location.href = res.url || '/dashboard';
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Error al iniciar sesión');
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/login', { method: 'POST', body: fd, redirect: 'follow' });
    if (res.ok || res.redirected) {
      window.location.href = res.url || '/dashboard';
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Credenciales incorrectas');
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <img
            src="/brand/rentiq-logo-dark.png"
            alt="RentIQ"
            className={styles.logo}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className={styles.logoFallback}>RentIQ</div>
        </div>
        <p className={styles.subtitle}>Gestión de Rent a Car</p>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {DEMO_MODE ? (
          <div className={styles.demoSection}>
            <p className={styles.demoHint}>Modo demo — selecciona un rol para entrar</p>
            <div className={styles.demoRoles}>
              {DEMO_ROLES.map((r) => (
                <button
                  key={r.value}
                  className={styles.demoBtn}
                  onClick={() => handleDemoLogin(r.value)}
                  disabled={loading}
                  type="button"
                >
                  <span className={styles.demoBtnTitle}>{r.label}</span>
                  <span className={styles.demoBtnDesc}>{r.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handlePasswordLogin}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className={styles.input}
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className={styles.input}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Accediendo…' : 'Acceder'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
