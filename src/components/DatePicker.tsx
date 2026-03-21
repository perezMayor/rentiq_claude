'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './DatePicker.module.css';

const DAYS_ES    = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS_ES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function toDate(str: string): Date | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function display(str: string): string {
  const d = toDate(str);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export default function DatePicker({
  value, onChange, className, style,
  placeholder = 'dd/mm/aaaa', disabled, min, max,
}: Props) {
  const today    = toStr(new Date());
  const selected = toDate(value);

  function initView() {
    const d = selected ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  const [open, setView_open] = useState(false);
  const [view, setView]      = useState(initView);
  const containerRef         = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setView_open(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Sync view with value when changed externally
  useEffect(() => {
    if (selected) setView({ year: selected.getFullYear(), month: selected.getMonth() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function openCalendar() {
    if (disabled) return;
    setView(initView());
    setView_open(true);
  }

  function prevMonth() {
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  }
  function nextMonth() {
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  }

  function selectDay(day: number) {
    const str = toStr(new Date(view.year, view.month, day));
    if (min && str < min) return;
    if (max && str > max) return;
    onChange(str);
    setView_open(false);
  }

  // Build grid cells
  const firstDow   = new Date(view.year, view.month, 1).getDay(); // 0=Sun
  const startOffset = (firstDow + 6) % 7;                          // Monday-first
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const daysInPrev  = new Date(view.year, view.month, 0).getDate();

  const cells: Array<{ day: number; current: boolean }> = [];
  for (let i = startOffset - 1; i >= 0; i--)   cells.push({ day: daysInPrev - i, current: false });
  for (let d = 1; d <= daysInMonth; d++)         cells.push({ day: d, current: true });
  const tail = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let d = 1; d <= tail; d++)                cells.push({ day: d, current: false });

  return (
    <div ref={containerRef} className={styles.wrap} style={{ width: style?.width ?? '100%', position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <div
        className={`${styles.trigger} ${disabled ? styles.triggerDisabled : ''} ${open ? styles.triggerOpen : ''} ${className ?? ''}`}
        style={style}
        onClick={openCalendar}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openCalendar(); }}
      >
        <span className={styles.iconWrap}>
          <svg className={styles.icon} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M1 7h14" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </span>
        <span className={value ? styles.triggerText : styles.triggerPlaceholder}>
          {value ? display(value) : placeholder}
        </span>
      </div>

      {/* Calendar popup */}
      {open && (
        <div className={styles.popup}>
          <div className={styles.header}>
            <button type="button" className={styles.navBtn} onClick={prevMonth}>
              <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className={styles.monthLabel}>{MONTHS_ES[view.month]} {view.year}</span>
            <button type="button" className={styles.navBtn} onClick={nextMonth}>
              <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className={styles.grid}>
            {DAYS_ES.map(d => (
              <div key={d} className={styles.dayHeader}>{d}</div>
            ))}
            {cells.map((cell, i) => {
              if (!cell.current) return <div key={i} className={styles.dayOther}>{cell.day}</div>;
              const str        = toStr(new Date(view.year, view.month, cell.day));
              const isSelected = str === value;
              const isToday    = str === today;
              const isDisabled = Boolean((min && str < min) || (max && str > max));
              return (
                <div
                  key={i}
                  className={[
                    styles.day,
                    isSelected                   ? styles.daySelected : '',
                    isToday && !isSelected       ? styles.dayToday    : '',
                    isDisabled                   ? styles.dayDisabled : '',
                  ].join(' ')}
                  onClick={() => !isDisabled && selectDay(cell.day)}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
