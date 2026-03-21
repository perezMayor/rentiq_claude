'use client';

import { useState } from 'react';
import type { VehicleInsurance } from '@/src/lib/types';
import styles from './gestion.module.css';

export interface FormInsurance {
  insuranceId: string;
  code: string;
  name: string;
  pricingMode: 'FIXED' | 'PER_DAY';
  unitPrice: number;
  maxDays?: number;
  quantity: number;
  total: number;
}

interface Props {
  catalogInsurances: VehicleInsurance[];
  formInsurances: FormInsurance[];
  billedDays: number;
  franchise: number;
  onChange: (insurances: FormInsurance[]) => void;
  onFranchiseChange: (value: number) => void;
}

export default function SegurosTabContent({
  catalogInsurances,
  formInsurances,
  billedDays,
  franchise,
  onChange,
  onFranchiseChange,
}: Props) {
  const [selId, setSelId]               = useState('');
  const [selPrice, setSelPrice]         = useState('');
  const [franquiciaOn, setFranquiciaOn] = useState(franchise > 0);

  const selectedCatalog = catalogInsurances.find((i) => i.id === selId);

  function handleSelect(id: string) {
    setSelId(id);
    const cat = catalogInsurances.find((i) => i.id === id);
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
    if (!selId || !selectedCatalog) return;
    if (formInsurances.find((i) => i.insuranceId === selId)) return;
    const total = computeTotal(selPrice, selectedCatalog.pricingMode, selectedCatalog.maxDays);
    onChange([
      ...formInsurances,
      {
        insuranceId: selId,
        code:        selectedCatalog.code,
        name:        selectedCatalog.name,
        pricingMode: selectedCatalog.pricingMode,
        unitPrice:   parseFloat(selPrice) || selectedCatalog.unitPrice,
        maxDays:     selectedCatalog.maxDays,
        quantity:    1,
        total,
      },
    ]);
    setSelId('');
    setSelPrice('');
  }

  function handleRemove(insuranceId: string) {
    onChange(formInsurances.filter((i) => i.insuranceId !== insuranceId));
  }

  function handleFranquiciaToggle(active: boolean) {
    setFranquiciaOn(active);
    if (active) {
      onChange([]);
      setSelId('');
      setSelPrice('');
    } else {
      onFranchiseChange(0);
    }
  }

  const grandTotal = formInsurances.reduce((s, i) => s + i.total, 0);
  const newTotal   = selectedCatalog
    ? computeTotal(selPrice, selectedCatalog.pricingMode, selectedCatalog.maxDays)
    : 0;

  const available = catalogInsurances.filter(
    (i) => i.active && !formInsurances.find((f) => f.insuranceId === i.id)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>

      {/* ── Add row ── */}
      <div className={styles.extrasAdd}>

        {/* Seguro desplegable (oculto si franquicia activa) */}
        {!franquiciaOn && (
          <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 160 }}>
            <label className="form-label">Seguro</label>
            <select
              className="form-select"
              value={selId}
              onChange={(e) => handleSelect(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {available.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code ? `[${i.code}] ` : ''}{i.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Importe seguro (oculto si franquicia activa) */}
        {!franquiciaOn && (
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
              disabled={!selId}
            />
          </div>
        )}

        {/* Total seguro (oculto si franquicia activa) */}
        {!franquiciaOn && (
          <div className="form-group" style={{ margin: 0, width: 88 }}>
            <label className="form-label">Total</label>
            <input
              className="form-input"
              readOnly
              value={selectedCatalog ? `${newTotal.toFixed(2)} €` : '—'}
              style={{ color: 'var(--color-text-muted)', textAlign: 'right' }}
            />
          </div>
        )}

        {/* Botón añadir (oculto si franquicia activa) */}
        {!franquiciaOn && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={!selId}
            style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
          >
            + Añadir
          </button>
        )}

        {/* Franquicia: importe (visible si activa) */}
        {franquiciaOn && (
          <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 160 }}>
            <label className="form-label">Importe franquicia</label>
            <input
              type="number"
              className="form-input"
              min={0}
              step="0.01"
              value={franchise || ''}
              onChange={(e) => onFranchiseChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
        )}

        {/* Switcher franquicia — siempre al final de la fila */}
        <div className="form-group" style={{ margin: 0, alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            Franquicia
          </span>
          <div
            onClick={() => handleFranquiciaToggle(!franquiciaOn)}
            style={{
              width: 30, height: 16, borderRadius: 8, cursor: 'pointer', position: 'relative',
              background: franquiciaOn ? 'var(--color-primary)' : 'var(--color-border)',
              transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: franquiciaOn ? 14 : 2,
              width: 12, height: 12, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </div>
        </div>

      </div>

      {/* ── Summary table (solo si hay seguros y franquicia desactivada) ── */}
      {!franquiciaOn && (
        formInsurances.length > 0 ? (
          <table className={styles.extrasTable}>
            <thead>
              <tr>
                <th>Seguro</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Importe</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {formInsurances.map((i) => (
                <tr key={i.insuranceId}>
                  <td>
                    {i.code ? <><code style={{ fontSize: '0.78rem', background: 'var(--color-surface)', padding: '1px 5px', borderRadius: 3 }}>{i.code}</code>{' '}</> : ''}
                    {i.name}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                    {i.pricingMode === 'FIXED' ? 'Fijo' : `Por día${i.maxDays ? ` (máx. ${i.maxDays})` : ''}`}
                  </td>
                  <td style={{ textAlign: 'right' }}>{i.unitPrice.toFixed(2)} €</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.total.toFixed(2)} €</td>
                  <td>
                    <button
                      type="button"
                      className={styles.extrasRemove}
                      onClick={() => handleRemove(i.insuranceId)}
                      title="Quitar seguro"
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
                  Total seguros
                </td>
                <td style={{ textAlign: 'right' }}>{grandTotal.toFixed(2)} €</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        ) : (
          catalogInsurances.filter((i) => i.active).length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              No hay seguros configurados. Añádelos desde Vehículos → Seguros.
            </div>
          ) : null
        )
      )}
    </div>
  );
}
