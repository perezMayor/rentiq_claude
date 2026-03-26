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
  logoDataUrl: string;
  documentName: string;
  documentFooter: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  companyPhone: string;
  companyEmailFrom: string;
  fiscalAddress: string;
  taxId: string;
}

const BRANDING_DEFAULTS: BrandingData = {
  logoDataUrl: '',
  documentName: '',
  documentFooter: '',
  brandPrimaryColor: '#2563eb',
  brandSecondaryColor: '#0f172a',
  companyPhone: '',
  companyEmailFrom: '',
  fiscalAddress: '',
  taxId: '',
};

function BrandingTab() {
  const [data, setData] = useState<BrandingData>(BRANDING_DEFAULTS);
  const [userRole, setUserRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const [empRes, meRes] = await Promise.all([fetch('/api/gestor/empresa'), fetch('/api/me')]);
      if (meRes.ok) setUserRole((await meRes.json()).role ?? '');
      if (empRes.ok) {
        const d = await empRes.json();
        const s = d.settings ?? d ?? {};
        setData({
          logoDataUrl:        s.logoDataUrl        ?? '',
          documentName:       s.documentName       ?? s.name ?? '',
          documentFooter:     s.documentFooter     ?? '',
          brandPrimaryColor:  s.brandPrimaryColor  ?? '#2563eb',
          brandSecondaryColor:s.brandSecondaryColor ?? '#0f172a',
          companyPhone:       s.companyPhone       ?? s.phone ?? '',
          companyEmailFrom:   s.companyEmailFrom   ?? s.email ?? '',
          fiscalAddress:      s.fiscalAddress      ?? s.address ?? '',
          taxId:              s.taxId              ?? s.nif ?? '',
        });
      }
    }
    load();
  }, []);

  const canWrite = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    const res = await fetch('/api/gestor/empresa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Error al guardar'); }
    setSaving(false);
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setData((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  function colorField(label: string, key: 'brandPrimaryColor' | 'brandSecondaryColor') {
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={data[key]} onChange={(e) => setData({ ...data, [key]: e.target.value })}
            disabled={!canWrite} style={{ width: 44, height: 34, padding: 2, border: '1px solid var(--color-border)', borderRadius: 6, cursor: canWrite ? 'pointer' : 'not-allowed' }} />
          <input className="form-input" value={data[key]} onChange={(e) => setData({ ...data, [key]: e.target.value })}
            disabled={!canWrite} style={{ flex: 1, fontFamily: 'monospace' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Branding de documentos</h1></div></div>
      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {saved && <div className="alert" style={{ marginBottom: 16, background: '#f0fdf4', borderLeft: '4px solid #15803d', color: '#14532d' }}>Branding guardado correctamente.</div>}

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Left: config */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>Logo de empresa</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: -10 }}>
              Este logo aparece en las cabeceras de confirmaciones, presupuestos y facturas.
            </p>

            {data.logoDataUrl && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, background: 'var(--color-surface)', textAlign: 'center' }}>
                <img src={data.logoDataUrl} alt="Logo empresa" style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain' }} />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Subir logo (PNG, SVG, JPG)</label>
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoFile} disabled={!canWrite || uploading}
                className="form-input" style={{ padding: '5px 8px' }} />
              {uploading && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Procesando…</span>}
            </div>

            {data.logoDataUrl && canWrite && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}
                onClick={() => setData((p) => ({ ...p, logoDataUrl: '' }))}>
                Eliminar logo
              </button>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />
            <h3 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Colores corporativos</h3>
            {colorField('Color principal (cabeceras, botones)', 'brandPrimaryColor')}
            {colorField('Color secundario (textos, accentos)', 'brandSecondaryColor')}

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />
            <h3 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Datos en documentos</h3>

            <div className="form-group">
              <label className="form-label">Nombre de empresa en documentos</label>
              <input className="form-input" value={data.documentName}
                onChange={(e) => setData({ ...data, documentName: e.target.value })}
                disabled={!canWrite} placeholder="Mi Rent a Car S.L." />
            </div>
            <div className="form-group">
              <label className="form-label">NIF / CIF en documentos</label>
              <input className="form-input" value={data.taxId}
                onChange={(e) => setData({ ...data, taxId: e.target.value })}
                disabled={!canWrite} placeholder="B12345678" />
            </div>
            <div className="form-group">
              <label className="form-label">Dirección fiscal</label>
              <input className="form-input" value={data.fiscalAddress}
                onChange={(e) => setData({ ...data, fiscalAddress: e.target.value })}
                disabled={!canWrite} placeholder="Calle Ejemplo 1, 28001 Madrid" />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono en documentos</label>
              <input className="form-input" value={data.companyPhone}
                onChange={(e) => setData({ ...data, companyPhone: e.target.value })}
                disabled={!canWrite} placeholder="+34 900 000 000" />
            </div>
            <div className="form-group">
              <label className="form-label">Email de contacto en documentos</label>
              <input type="email" className="form-input" value={data.companyEmailFrom}
                onChange={(e) => setData({ ...data, companyEmailFrom: e.target.value })}
                disabled={!canWrite} placeholder="reservas@miempresa.es" />
            </div>
            <div className="form-group">
              <label className="form-label">Pie de página de documentos</label>
              <textarea className="form-textarea" value={data.documentFooter}
                onChange={(e) => setData({ ...data, documentFooter: e.target.value })}
                disabled={!canWrite} rows={2}
                placeholder="Mi Rent a Car S.L. · CIF B12345678 · reservas@miempresa.es" />
            </div>

            {canWrite && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar branding'}
              </button>
            )}
          </div>

          {/* Right: preview */}
          <div className="card">
            <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.95rem' }}>Vista previa en documentos</h3>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', fontSize: '0.8rem' }}>
              <div style={{ background: '#fff', borderBottom: `3px solid ${data.brandPrimaryColor}`, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {data.logoDataUrl
                    ? <img src={data.logoDataUrl} alt="Logo" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain' }} />
                    : <div style={{ fontWeight: 700, fontSize: '1rem', color: data.brandSecondaryColor }}>{data.documentName || 'LOGO EMPRESA'}</div>}
                </div>
                <div style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.75rem', lineHeight: 1.5 }}>
                  {data.taxId && <div>{data.taxId}</div>}
                  {data.fiscalAddress && <div>{data.fiscalAddress}</div>}
                  {data.companyPhone && <div>{data.companyPhone}</div>}
                </div>
              </div>
              <div style={{ padding: '16px 18px', background: '#fff', color: '#1e293b' }}>
                <div style={{ fontWeight: 700, color: data.brandPrimaryColor, fontSize: '1.1rem', marginBottom: 10 }}>Confirmación de reserva</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.75rem' }}>
                  {[['Reserva', 'RSV-2026-000001'], ['Cliente', 'Juan García'], ['Entrega', '04/04/2026 · Hotel Entremares'], ['Recogida', '11/04/2026 · Aeropuerto']].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>{l}</div>
                      <div style={{ fontWeight: 500, color: data.brandSecondaryColor }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#f8fafc', borderTop: '1px solid var(--color-border)', padding: '8px 18px', color: '#94a3b8', textAlign: 'center', fontSize: '0.7rem' }}>
                {data.documentFooter || `${data.documentName || 'Mi empresa'} · ${data.taxId || 'CIF'} · ${data.companyEmailFrom || 'email@empresa.es'}`}
              </div>
            </div>
          </div>
        </div>
      </form>
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
