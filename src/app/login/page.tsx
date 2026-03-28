'use client';

import { useState, useEffect } from 'react';
import styles from './login.module.css';

interface Branch {
  id: string;
  name: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    // Leer parámetro de error de URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'invalid') {
      setError('Email o contraseña incorrectos');
    }

    // Cargar nombre de empresa y sucursales (endpoint público, sin auth)
    fetch('/api/public/empresa')
      .then((r) => r.json())
      .then((d) => {
        if (d.companyName) setCompanyName(d.companyName);
        if (Array.isArray(d.branches)) {
          setBranches(d.branches);
          // Preseleccionar sucursal por defecto
          if (d.defaultBranchId) setBranchId(d.defaultBranchId);
          else if (d.branches.length > 0) setBranchId(d.branches[0].id);
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    if (branchId) fd.set('branchId', branchId);
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

        <form className={styles.form} onSubmit={handleLogin}>
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

          {companyName && (
            <div className={styles.companyName}>{companyName}</div>
          )}

          {branches.length > 0 && (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="branchId">
                Sucursal
              </label>
              <select
                id="branchId"
                className={styles.select}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Accediendo…' : 'Acceder'}
          </button>
        </form>
      </div>
    </div>
  );
}
