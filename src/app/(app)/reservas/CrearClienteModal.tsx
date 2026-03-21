'use client';

import { useState } from 'react';
import type { Client } from '@/src/lib/types';
import styles from './gestion.module.css';

interface Props {
  onCreated: (client: Client) => void;
  onClose: () => void;
}

interface ClientForm {
  type: 'PARTICULAR' | 'EMPRESA' | 'COMISIONISTA';
  name: string;
  surname: string;
  nif: string;
  email: string;
  phone: string;
  companyName: string;
}

export default function CrearClienteModal({ onCreated, onClose }: Props) {
  const [form, setForm] = useState<ClientForm>({
    type: 'PARTICULAR',
    name: '',
    surname: '',
    nif: '',
    email: '',
    phone: '',
    companyName: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof ClientForm>(field: K, value: ClientForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        type: form.type,
        name: form.name.trim(),
      };
      if (form.surname.trim())     payload.surname     = form.surname.trim();
      if (form.nif.trim())         payload.nif         = form.nif.trim();
      if (form.email.trim())       payload.email       = form.email.trim();
      if (form.phone.trim())       payload.phone       = form.phone.trim();
      if (form.companyName.trim()) payload.companyName = form.companyName.trim();

      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Error al crear cliente');
      }
      const { client } = await res.json();
      onCreated(client);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span>Nuevo cliente</span>
          <button type="button" className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <div className="alert alert-danger" style={{ margin: 0 }}>{error}</div>}

            <div className={styles.grid2}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tipo *</label>
                <select className="form-select" value={form.type} onChange={(e) => set('type', e.target.value as ClientForm['type'])}>
                  <option value="PARTICULAR">Particular</option>
                  <option value="EMPRESA">Empresa</option>
                  <option value="COMISIONISTA">Comisionista</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">DNI / Pasaporte</label>
                <input className="form-input" value={form.nif} onChange={(e) => set('nif', e.target.value)} placeholder="12345678A" />
              </div>
            </div>

            <div className={styles.grid2}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre" required autoFocus />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Apellidos</label>
                <input className="form-input" value={form.surname} onChange={(e) => set('surname', e.target.value)} placeholder="Apellidos" />
              </div>
            </div>

            {(form.type === 'EMPRESA' || form.type === 'COMISIONISTA') && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Razón social</label>
                <input className="form-input" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Nombre de la empresa" />
              </div>
            )}

            <div className={styles.grid2}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Teléfono</label>
                <input className="form-input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+34 600 000 000" />
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
