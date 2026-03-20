'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

const TABS = [
  { key: 'empresa',  label: 'Datos de empresa' },
  { key: 'branding', label: 'Branding documentos' },
];

// ─── Tab nav ──────────────────────────────────────────────────────────────────

function ConfigTabNav({ active }: { active: string }) {
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
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => go(t.key)}
          style={{
            padding: '7px 14px',
            fontSize: '0.82rem',
            fontWeight: active === t.key ? 600 : 500,
            color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
            background: active === t.key ? 'var(--color-surface-strong)' : 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'Poppins, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// ─── Empresa tab ──────────────────────────────────────────────────────────────

interface EmpresaData {
  name: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
  invoiceSeries: string;
  ivaPercent: number;
}

function EmpresaTab() {
  const [data, setData] = useState<EmpresaData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    async function load() {
      const [empRes, meRes] = await Promise.all([
        fetch('/api/gestor/empresa'),
        fetch('/api/me'),
      ]);
      if (empRes.ok) setData(await empRes.json());
      if (meRes.ok) setUserRole((await meRes.json()).role ?? '');
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError('');
    setSaved(false);
    const res = await fetch('/api/gestor/empresa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Error al guardar');
    }
    setSaving(false);
  }

  const canWrite = userRole === 'SUPER_ADMIN';

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Cargando…</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Datos de empresa</h1>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>Datos guardados correctamente.</div>}

      <div className="card">
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div className="form-group">
              <label className="form-label">Nombre de empresa *</label>
              <input
                className="form-input"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                required
                disabled={!canWrite}
                placeholder="Mi Rent a Car S.L."
              />
            </div>

            <div className="form-group">
              <label className="form-label">NIF / CIF *</label>
              <input
                className="form-input"
                value={data.nif}
                onChange={(e) => setData({ ...data, nif: e.target.value })}
                required
                disabled={!canWrite}
                placeholder="B12345678"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Dirección fiscal</label>
              <input
                className="form-input"
                value={data.address}
                onChange={(e) => setData({ ...data, address: e.target.value })}
                disabled={!canWrite}
                placeholder="Calle Ejemplo 1, 28001 Madrid"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                className="form-input"
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                disabled={!canWrite}
                placeholder="+34 900 000 000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email de contacto</label>
              <input
                type="email"
                className="form-input"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                disabled={!canWrite}
                placeholder="info@mirentacar.es"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Serie de facturación</label>
              <input
                className="form-input"
                value={data.invoiceSeries}
                onChange={(e) => setData({ ...data, invoiceSeries: e.target.value })}
                disabled={!canWrite}
                placeholder="F"
              />
            </div>

            <div className="form-group">
              <label className="form-label">IVA por defecto (%)</label>
              <input
                type="number"
                className="form-input"
                value={data.ivaPercent}
                onChange={(e) => setData({ ...data, ivaPercent: Number(e.target.value) })}
                disabled={!canWrite}
                min={0}
                max={100}
                step={0.01}
              />
            </div>
          </div>

          {canWrite && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Branding tab ─────────────────────────────────────────────────────────────

interface BrandingData {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
}

function BrandingTab() {
  const [data, setData] = useState<BrandingData>({
    logoUrl: '',
    primaryColor: '#1e3a5f',
    secondaryColor: '#2b6cbd',
    footerText: '',
  });
  const [userRole, setUserRole] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const meRes = await fetch('/api/me');
      if (meRes.ok) setUserRole((await meRes.json()).role ?? '');
      // TODO: load from company settings when branding fields are added to store
    }
    load();
  }, []);

  const canWrite = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Branding de documentos</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Configuration */}
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.95rem' }}>Configuración de documentos</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">URL del logo de empresa</label>
              <input
                className="form-input"
                value={data.logoUrl}
                onChange={(e) => setData({ ...data, logoUrl: e.target.value })}
                disabled={!canWrite}
                placeholder="https://miempresa.com/logo.png o /uploads/logo.png"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Color corporativo principal</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={data.primaryColor}
                  onChange={(e) => setData({ ...data, primaryColor: e.target.value })}
                  disabled={!canWrite}
                  style={{ width: 48, height: 36, padding: 2, border: '1px solid var(--color-border)', borderRadius: 6, cursor: canWrite ? 'pointer' : 'not-allowed' }}
                />
                <input
                  className="form-input"
                  value={data.primaryColor}
                  onChange={(e) => setData({ ...data, primaryColor: e.target.value })}
                  disabled={!canWrite}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                  placeholder="#1e3a5f"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Color corporativo secundario</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  value={data.secondaryColor}
                  onChange={(e) => setData({ ...data, secondaryColor: e.target.value })}
                  disabled={!canWrite}
                  style={{ width: 48, height: 36, padding: 2, border: '1px solid var(--color-border)', borderRadius: 6, cursor: canWrite ? 'pointer' : 'not-allowed' }}
                />
                <input
                  className="form-input"
                  value={data.secondaryColor}
                  onChange={(e) => setData({ ...data, secondaryColor: e.target.value })}
                  disabled={!canWrite}
                  style={{ flex: 1, fontFamily: 'monospace' }}
                  placeholder="#2b6cbd"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Texto de pie de documento</label>
              <textarea
                className="form-input"
                value={data.footerText}
                onChange={(e) => setData({ ...data, footerText: e.target.value })}
                disabled={!canWrite}
                rows={2}
                placeholder="Mi Rent a Car S.L. · CIF B12345678 · Tel. 900 000 000"
                style={{ resize: 'vertical' }}
              />
            </div>

            {canWrite && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 3000); }}
              >
                {saved ? '¡Guardado!' : 'Guardar branding'}
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.95rem' }}>Vista previa de documento</h3>
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
            fontSize: '0.78rem',
          }}>
            {/* Doc header */}
            <div style={{
              background: data.primaryColor,
              color: '#fff',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div>
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="Logo empresa" style={{ height: 36, objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontWeight: 700, fontSize: '1rem', opacity: 0.9 }}>LOGO EMPRESA</div>
                )}
              </div>
              <div style={{ textAlign: 'right', opacity: 0.85 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>CONTRATO DE ALQUILER</div>
                <div style={{ fontSize: '0.72rem' }}>Nº CNT-2026-000001</div>
              </div>
            </div>

            {/* Doc body */}
            <div style={{ padding: '16px 20px', background: '#fff', color: '#111' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: data.secondaryColor }}>ARRENDADOR</div>
                  <div>Mi Empresa Rent a Car S.L.</div>
                  <div style={{ opacity: 0.6 }}>CIF: B12345678</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: data.secondaryColor }}>ARRENDATARIO</div>
                  <div>Nombre del Cliente</div>
                  <div style={{ opacity: 0.6 }}>DNI: 12345678A</div>
                </div>
              </div>
              <div style={{ height: 1, background: data.secondaryColor, opacity: 0.2, marginBottom: 12 }} />
              <div style={{ opacity: 0.5, textAlign: 'center', padding: '8px 0' }}>
                … contenido del contrato …
              </div>
            </div>

            {/* Doc footer */}
            <div style={{
              background: '#f5f5f5',
              borderTop: `2px solid ${data.primaryColor}`,
              padding: '8px 20px',
              color: '#666',
              textAlign: 'center',
              fontSize: '0.7rem',
            }}>
              {data.footerText || 'Pie de página de la empresa · Datos fiscales · Contacto'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ConfigInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') ?? 'empresa';

  return (
    <div>
      <ConfigTabNav active={tab} />
      {tab === 'empresa'  && <EmpresaTab />}
      {tab === 'branding' && <BrandingTab />}
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense>
      <ConfigInner />
    </Suspense>
  );
}
