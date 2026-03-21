'use client';

import { useState, useMemo } from 'react';
import type { Client } from '@/src/lib/types';
import styles from './gestion.module.css';

interface Props {
  clients: Client[];
  value: string;                          // texto visible en el input
  onTextChange: (text: string) => void;   // cuando el usuario escribe
  onSelect: (client: Client) => void;     // cuando selecciona una sugerencia
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function ClientAutocompleteInput({
  clients,
  value,
  onTextChange,
  onSelect,
  placeholder = 'Buscar…',
  className,
  style,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return clients
      .filter((c) => {
        const hay = [c.name, c.surname, c.nif, c.email, c.phone, c.companyName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [value, clients]);

  return (
    <div className={styles.searchWrap} style={{ position: 'relative', margin: 0 }}>
      <input
        className={className ?? 'form-input'}
        style={style}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onChange={(e) => {
          onTextChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className={styles.searchResults}>
          {suggestions.map((c) => (
            <div
              key={c.id}
              className={styles.searchItem}
              onMouseDown={() => {
                onSelect(c);
                setOpen(false);
              }}
            >
              <span className={styles.searchItemMain}>
                {c.type === 'EMPRESA' ? (c.companyName ?? c.name) : `${c.name}${c.surname ? ' ' + c.surname : ''}`}
              </span>
              <span className={styles.searchItemSub}>
                {[c.nif, c.phone, c.email].filter(Boolean).join(' · ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
