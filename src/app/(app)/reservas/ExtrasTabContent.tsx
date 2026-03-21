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

interface Props {
  catalogExtras: VehicleExtra[];
  formExtras: FormExtra[];
  billedDays: number;
  onChange: (extras: FormExtra[]) => void;
}

export default function ExtrasTabContent({ catalogExtras, formExtras, billedDays, onChange }: Props) {
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
    </div>
  );
}
