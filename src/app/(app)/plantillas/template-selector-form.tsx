'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const CONTRACT_REVERSE_CODE = 'REVERSO_CONTRATO';

const CODE_LABELS: Record<string, string> = {
  [CONTRACT_REVERSE_CODE]: 'Reverso de contrato',
};

type Props = {
  selectedCode: string;
  selectableTemplateCodes: string[];
};

export function TemplateSelectorForm({ selectedCode, selectableTemplateCodes }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(selectedCode);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    setValue(code);
    router.push(`/plantillas?code=${encodeURIComponent(code)}`);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Plantilla</label>
      <select className="form-select" value={value} onChange={handleChange} style={{ minWidth: 220 }}>
        {selectableTemplateCodes.map((code) => (
          <option key={code} value={code}>
            {CODE_LABELS[code] ?? code}
          </option>
        ))}
      </select>
      <a href="/plantillas?mode=new" className="btn btn-primary btn-sm">+ Nueva</a>
    </div>
  );
}
