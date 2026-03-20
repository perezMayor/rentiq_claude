'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import styles from './subtabs.module.css';

export interface Tab {
  key: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  paramName?: string;
}

export default function SubTabs({ tabs, paramName = 'tab' }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(paramName) ?? tabs[0]?.key ?? '';

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <nav className={styles.subtabs} aria-label="Sub-navegación">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`${styles.tab} ${active === t.key ? styles.tabActive : ''}`}
          onClick={() => go(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
