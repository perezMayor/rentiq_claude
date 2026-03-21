'use client';

import { useState } from 'react';
import type { Client } from '@/src/lib/types';
import DatePicker from '@/src/components/DatePicker';
import ClientAutocompleteInput from './ClientAutocompleteInput';
import styles from './gestion.module.css';

export interface FormConductor {
  clientId: string;
  nombre: string;
  apellidos: string;
  nif: string;
  licencia: string;
  licenciaExpiry: string;
  fechaNacimiento: string;
}

const blank = (): FormConductor => ({
  clientId: '', nombre: '', apellidos: '', nif: '', licencia: '', licenciaExpiry: '', fechaNacimiento: '',
});

interface Props {
  clients: Client[];
  conductores: FormConductor[];
  onChange: (conductores: FormConductor[]) => void;
}

export default function ConductoresTabContent({ clients, conductores, onChange }: Props) {
  const [draft, setDraft] = useState<FormConductor>(blank());

  function handleSelect(c: Client) {
    setDraft({
      clientId:        c.id,
      nombre:          c.name,
      apellidos:       c.surname ?? '',
      nif:             c.nif ?? '',
      licencia:        c.licenseNumber ?? '',
      licenciaExpiry:  draft.licenciaExpiry,
      fechaNacimiento: draft.fechaNacimiento,
    });
  }

  function handleAdd() {
    if (!draft.nombre.trim()) return;
    onChange([...conductores, { ...draft }]);
    setDraft(blank());
  }

  function handleRemove(idx: number) {
    onChange(conductores.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>

      {/* ── Fila de añadir ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>

        <div className="form-group" style={{ margin: 0, width: 90 }}>
          <label className="form-label">ID</label>
          <input
            className="form-input"
            readOnly
            value={draft.clientId}
            placeholder="—"
            style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}
            title="Se rellena automáticamente si el conductor está en el sistema"
          />
        </div>

        <div className="form-group" style={{ margin: 0, flex: '1 1 130px', minWidth: 120 }}>
          <label className="form-label">Nombre</label>
          <ClientAutocompleteInput
            clients={clients}
            value={draft.nombre}
            onTextChange={(v) => setDraft({ ...draft, nombre: v, clientId: '' })}
            onSelect={handleSelect}
            placeholder="Nombre"
          />
        </div>

        <div className="form-group" style={{ margin: 0, flex: '1 1 130px', minWidth: 120 }}>
          <label className="form-label">Apellidos</label>
          <ClientAutocompleteInput
            clients={clients}
            value={draft.apellidos}
            onTextChange={(v) => setDraft({ ...draft, apellidos: v, clientId: '' })}
            onSelect={handleSelect}
            placeholder="Apellidos"
          />
        </div>

        <div className="form-group" style={{ margin: 0, width: 110 }}>
          <label className="form-label">DNI / Pasaporte</label>
          <ClientAutocompleteInput
            clients={clients}
            value={draft.nif}
            onTextChange={(v) => setDraft({ ...draft, nif: v, clientId: '' })}
            onSelect={handleSelect}
            placeholder="DNI / Pasaporte"
          />
        </div>

        <div className="form-group" style={{ margin: 0, width: 110 }}>
          <label className="form-label">Nº licencia</label>
          <input
            className="form-input"
            value={draft.licencia}
            onChange={(e) => setDraft({ ...draft, licencia: e.target.value })}
            placeholder="Licencia"
          />
        </div>

        <div className="form-group" style={{ margin: 0, width: 120 }}>
          <label className="form-label">Cad. carnet</label>
          <DatePicker
            className="form-input"
            value={draft.licenciaExpiry}
            onChange={(v) => setDraft({ ...draft, licenciaExpiry: v })}
          />
        </div>

        <div className="form-group" style={{ margin: 0, width: 120 }}>
          <label className="form-label">F. nacimiento</label>
          <DatePicker
            className="form-input"
            value={draft.fechaNacimiento}
            onChange={(v) => setDraft({ ...draft, fechaNacimiento: v })}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleAdd}
          disabled={!draft.nombre.trim()}
          style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
        >
          + Añadir
        </button>
      </div>

      {/* ── Tabla de conductores añadidos ── */}
      {conductores.length > 0 ? (
        <table className={styles.extrasTable}>
          <thead>
            <tr>
              <th style={{ width: 90 }}>ID</th>
              <th>Nombre</th>
              <th>Apellidos</th>
              <th>DNI / Pasaporte</th>
              <th>Licencia</th>
              <th>Cad. carnet</th>
              <th>F. nacimiento</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {conductores.map((c, idx) => (
              <tr key={idx}>
                <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  {c.clientId
                    ? <code style={{ background: 'var(--color-surface)', padding: '1px 5px', borderRadius: 3 }}>{c.clientId.slice(-8)}</code>
                    : '—'}
                </td>
                <td>{c.nombre}</td>
                <td>{c.apellidos || '—'}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{c.nif || '—'}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{c.licencia || '—'}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{c.licenciaExpiry || '—'}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{c.fechaNacimiento || '—'}</td>
                <td>
                  <button
                    type="button"
                    className={styles.extrasRemove}
                    onClick={() => handleRemove(idx)}
                    title="Quitar conductor"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', fontStyle: 'italic', padding: '2px 0' }}>
          Sin conductores adicionales. Escribe un nombre o busca por DNI para añadir.
        </div>
      )}

    </div>
  );
}
