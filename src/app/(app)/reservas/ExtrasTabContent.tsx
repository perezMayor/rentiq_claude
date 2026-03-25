'use client';

import { useState } from 'react';
import type { VehicleExtra } from '@/src/lib/types';
import styles from './gestion.module.css';

export interface FormExtra {
  extraId: string;
  code: string;
  name: string;
  pricingMode: 'FIXED' | 'PER_DAY';
  unitPrice: number;
  maxDays?: number;
  quantity: number;
  total: number;
}

export interface NightFeeConfig {
  fromHour: number;
  toHour: number;
  price: number;
}

interface Props {
  catalogExtras: VehicleExtra[];
  formExtras: FormExtra[];
  billedDays: number;
  onChange: (extras: FormExtra[]) => void;
  nightFeeConfig?: NightFeeConfig | null;
  nightFeeApplied?: boolean;
  onNightFeeToggle?: (v: boolean) => void;
}

export default function ExtrasTabContent({ catalogExtras, formExtras, billedDays, onChange, nightFeeConfig, nightFeeApplied, onNightFeeToggle }: Props) {
  const [selExtraId, setSelExtraId] = useState('');
  const [selPrice, setSelPrice]     = useState('');

  const selectedCatalog = catalogExtras.find((e) => e.id === selExtraId);

  function handleSelectExtra(id: string) {
    setSelExtraId(id);
    const cat = catalogExtras.find((e) => e.id === id);
    setSelPrice(cat ? String(cat.unitPrice) : '');
  }

  function computeTotal(price: string, pricingMode: 'FIXED' | 'PER_DAY', maxDays?: number): number {
    const p = parseFloat(price) || 0;
    let d = 1;
    if (pricingMode === 'PER_DAY') {
      const raw = billedDays || 1;
      d = maxDays && maxDays > 0 ? Math.min(raw, maxDays) : raw;
    }
    return Math.round(p * d * 100) / 100;
  }

  function handleAdd() {
    if (!selExtraId || !selectedCatalog) return;
    if (formExtras.find((e) => e.extraId === selExtraId)) return;
    const total = computeTotal(selPrice, selectedCatalog.pricingMode, selectedCatalog.maxDays);
    onChange([
      ...formExtras,
      {
        extraId:     selExtraId,
        code:        selectedCatalog.code,
        name:        selectedCatalog.name,
        pricingMode: selectedCatalog.pricingMode,
        unitPrice:   parseFloat(selPrice) || selectedCatalog.unitPrice,
        maxDays:     selectedCatalog.maxDays,
        quantity:    1,
        total,
      },
    ]);
    setSelExtraId('');
    setSelPrice('');
  }

  function handleRemove(extraId: string) {
    onChange(formExtras.filter((e) => e.extraId !== extraId));
  }

  const grandTotal = formExtras.reduce((s, e) => s + e.total, 0);
  const newTotal   = selectedCatalog
    ? computeTotal(selPrice, selectedCatalog.pricingMode, selectedCatalog.maxDays)
    : 0;

  const available = catalogExtras.filter(
    (e) => e.active && !formExtras.find((f) => f.extraId === e.id)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>

      {/* ── Add row ── */}
      <div className={styles.extrasAdd}>
        <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 160 }}>
          <label className="form-label">Extra</label>
          <select
            className="form-select"
            value={selExtraId}
            onChange={(e) => handleSelectExtra(e.target.value)}
          >
            <option value="">— Seleccionar extra —</option>
            {available.length === 0 && catalogExtras.length === 0 && (
              <option disabled>No hay extras configurados</option>
            )}
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code ? `[${e.code}] ` : ''}{e.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0, width: 100 }}>
          <label className="form-label">
            {selectedCatalog?.pricingMode === 'PER_DAY' ? 'Importe/día' : 'Importe'}
          </label>
          <input
            className="form-input"
            type="number"
            min={0}
            step="0.01"
            value={selPrice}
            onChange={(e) => setSelPrice(e.target.value)}
            placeholder="0.00"
            disabled={!selExtraId}
          />
        </div>

        <div className="form-group" style={{ margin: 0, width: 96 }}>
          <label className="form-label">Total</label>
          <input
            className="form-input"
            readOnly
            value={selectedCatalog ? `${newTotal.toFixed(2)} €` : '—'}
            style={{ color: 'var(--color-text-muted)', textAlign: 'right' }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleAdd}
          disabled={!selExtraId}
          style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
        >
          + Añadir
        </button>
      </div>

      {/* ── Summary table ── */}
      {formExtras.length > 0 ? (
        <table className={styles.extrasTable}>
          <thead>
            <tr>
              <th>Extra</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'right' }}>Importe</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {formExtras.map((e) => (
              <tr key={e.extraId}>
                <td>{e.code ? <><code style={{ fontSize: '0.78rem', background: 'var(--color-surface)', padding: '1px 5px', borderRadius: 3 }}>{e.code}</code>{' '}</> : ''}{e.name}</td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                  {e.pricingMode === 'FIXED' ? 'Fijo' : `Por día${e.maxDays ? ` (máx. ${e.maxDays})` : ''}`}
                </td>
                <td style={{ textAlign: 'right' }}>{e.unitPrice.toFixed(2)} €</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{e.total.toFixed(2)} €</td>
                <td>
                  <button
                    type="button"
                    className={styles.extrasRemove}
                    onClick={() => handleRemove(e.extraId)}
                    title="Quitar extra"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={styles.extrasTotalRow}>
              <td colSpan={3} style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>
                Total extras
              </td>
              <td style={{ textAlign: 'right' }}>{grandTotal.toFixed(2)} €</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', fontStyle: 'italic', padding: '2px 0' }}>
          Sin extras añadidos. Selecciona un extra del catálogo y pulsa &ldquo;+ Añadir&rdquo;.
        </div>
      )}

      {catalogExtras.filter((e) => e.active).length === 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
          No hay extras configurados en el sistema. Puedes añadirlos desde Vehículos → Extras.
        </div>
      )}

      {/* ── Night Fee ── */}
      {nightFeeConfig && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px',
          background: nightFeeApplied ? 'rgba(43,108,189,0.07)' : 'var(--color-surface)',
          border: `1px solid ${nightFeeApplied ? 'rgba(43,108,189,0.25)' : 'var(--color-border)'}`,
          borderRadius: 6, marginTop: 4,
          transition: 'background 0.15s, border-color 0.15s',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              🌙 Tarifa nocturna
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
              {String(nightFeeConfig.fromHour).padStart(2, '0')}:00 – {String(nightFeeConfig.toHour).padStart(2, '0')}:00 · {nightFeeConfig.price.toFixed(2)} €
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onNightFeeToggle ? 'pointer' : 'default' }}>
            <span style={{ fontSize: '0.8rem', color: nightFeeApplied ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: nightFeeApplied ? 600 : 400 }}>
              {nightFeeApplied ? `+${nightFeeConfig.price.toFixed(2)} €` : 'No aplicada'}
            </span>
            <div
              role="switch"
              aria-checked={nightFeeApplied}
              onClick={() => onNightFeeToggle?.(!nightFeeApplied)}
              style={{
                width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                background: nightFeeApplied ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: nightFeeApplied ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
