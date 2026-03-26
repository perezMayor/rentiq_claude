'use client';

import { useMemo, useState } from 'react';
import type { TemplateFunctionName } from '@/src/lib/services/template-function-catalog';
import { TEMPLATE_FUNCTION_OPTIONS } from '@/src/lib/services/template-function-catalog';
import { renderTemplateWithMacros } from '@/src/lib/services/template-renderer';
import { buildVisualTemplateHtml, type VisualTemplateType, type VisualTemplateConfig } from '@/src/lib/services/template-visual-builder';
import { TemplatePreview } from './template-preview';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  canWrite: boolean;
  selectedTemplateId: string;
  selectedTemplateCode: string;
  selectedTemplateLanguage: string;
  selectedTemplateTitle: string;
  selectedTemplateFunction: TemplateFunctionName;
  selectedTemplateActive: boolean;
  selectedVisualType: VisualTemplateType;
  visualConfig: VisualTemplateConfig;
  companyName: string;
  companyPhone: string;
  companyEmailFrom: string;
  logoDataUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  documentFooter: string;
  selectedHtmlContent: string;
  previewData: Record<string, unknown>;
};

export function VisualTemplateEditor({
  action,
  canWrite,
  selectedTemplateId,
  selectedTemplateCode,
  selectedTemplateLanguage,
  selectedTemplateTitle,
  selectedTemplateFunction,
  selectedTemplateActive,
  selectedVisualType,
  visualConfig: initialConfig,
  brandPrimaryColor,
  brandSecondaryColor,
  selectedHtmlContent,
  previewData,
}: Props) {
  const [config, setConfig] = useState<VisualTemplateConfig>(initialConfig);
  const [title, setTitle] = useState(selectedTemplateTitle);
  const [active, setActive] = useState(selectedTemplateActive);
  const [templateFunction, setTemplateFunction] = useState<TemplateFunctionName>(selectedTemplateFunction || '');
  const [saveSource, setSaveSource] = useState<'visual' | 'html'>('visual');
  const [htmlOverride, setHtmlOverride] = useState(selectedHtmlContent);

  const generatedHtml = useMemo(
    () => buildVisualTemplateHtml(selectedVisualType, selectedTemplateLanguage, config, { primaryColor: brandPrimaryColor, secondaryColor: brandSecondaryColor }),
    [selectedVisualType, selectedTemplateLanguage, config, brandPrimaryColor, brandSecondaryColor],
  );

  const currentHtml = saveSource === 'html' ? htmlOverride : generatedHtml;

  const previewHtml = useMemo(
    () => renderTemplateWithMacros(currentHtml, previewData as Record<string, string>),
    [currentHtml, previewData],
  );

  function updateText(key: keyof VisualTemplateConfig, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaveSource('visual');
  }

  function updateBool(key: keyof VisualTemplateConfig, value: boolean) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaveSource('visual');
  }

  return (
    <section className="card stack-sm">
      <h3>Editor visual — {selectedTemplateCode}</h3>
      <form action={action} className="stack-sm">
        <input type="hidden" name="saveSource" value={saveSource} />
        <input type="hidden" name="templateId" value={selectedTemplateId} />
        <input type="hidden" name="templateCode" value={selectedTemplateCode} />
        <input type="hidden" name="templateType" value={selectedVisualType} />
        <input type="hidden" name="language" value={selectedTemplateLanguage} />
        <input type="hidden" name="htmlContent" value={htmlOverride} />
        <input type="hidden" name="visualTitle" value={config.title} />
        <input type="hidden" name="visualIntro" value={config.intro} />
        <input type="hidden" name="visualFooter" value={config.footer} />
        <input type="hidden" name="visualAdditionalText" value={config.additionalText} />
        <input type="hidden" name="showContractNumber" value={String(config.showContractNumber)} />
        <input type="hidden" name="showCompany" value={String(config.showCompany)} />
        <input type="hidden" name="showReservationBlock" value={String(config.showReservationBlock)} />
        <input type="hidden" name="showBaseData" value={String(config.showBaseData)} />
        <input type="hidden" name="showPricingBlock" value={String(config.showPricingBlock)} />
        <input type="hidden" name="showExtrasTable" value={String(config.showExtrasTable)} />
        <input type="hidden" name="showObservations" value={String(config.showObservations)} />
        <input type="hidden" name="showAdditionalText" value={String(config.showAdditionalText)} />

        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Título de la plantilla</span>
            <input className="form-input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canWrite} />
          </label>
          <label className="form-group">
            <span className="form-label">Función asociada</span>
            <select className="form-select" name="templateFunction" value={templateFunction} onChange={(e) => setTemplateFunction(e.target.value as TemplateFunctionName)} disabled={!canWrite}>
              {TEMPLATE_FUNCTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Activa</span>
            <select className="form-select" name="active" value={active ? 'true' : 'false'} onChange={(e) => setActive(e.target.value === 'true')} disabled={!canWrite}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </label>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          <p className="form-label" style={{ marginBottom: 12 }}>Configuración del documento</p>
          <div className="form-grid">
            <label className="form-group">
              <span className="form-label">Título del documento</span>
              <input className="form-input" value={config.title} onChange={(e) => updateText('title', e.target.value)} disabled={!canWrite} />
            </label>
            <label className="form-group col-span-2">
              <span className="form-label">Texto introductorio</span>
              <textarea className="form-textarea" rows={2} value={config.intro} onChange={(e) => updateText('intro', e.target.value)} disabled={!canWrite} />
            </label>
            <label className="form-group col-span-2">
              <span className="form-label">Pie de página</span>
              <input className="form-input" value={config.footer} onChange={(e) => updateText('footer', e.target.value)} disabled={!canWrite} />
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginTop: 12 }}>
            {([
              ['showCompany', 'Datos empresa'],
              ['showReservationBlock', 'Bloque reserva/detalles'],
              ['showBaseData', 'Datos vehículo/tarifa'],
              ['showPricingBlock', 'Desglose de precio'],
              ['showExtrasTable', 'Info adicional / extras'],
              ['showObservations', 'Observaciones'],
              ['showContractNumber', 'Nº de contrato'],
              ['showAdditionalText', 'Texto adicional'],
            ] as [keyof VisualTemplateConfig, string][]).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={Boolean(config[key])}
                  onChange={(e) => updateBool(key, e.target.checked)}
                  disabled={!canWrite}
                />
                {label}
              </label>
            ))}
          </div>

          {config.showAdditionalText && (
            <label className="form-group" style={{ marginTop: 12 }}>
              <span className="form-label">Texto adicional</span>
              <textarea className="form-textarea" rows={3} value={config.additionalText} onChange={(e) => updateText('additionalText', e.target.value)} disabled={!canWrite} />
            </label>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p className="form-label" style={{ margin: 0 }}>HTML manual (avanzado)</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={saveSource === 'html'} onChange={(e) => setSaveSource(e.target.checked ? 'html' : 'visual')} disabled={!canWrite} />
              Usar HTML manual
            </label>
          </div>
          {saveSource === 'html' && (
            <textarea
              className="form-textarea"
              rows={10}
              value={htmlOverride}
              onChange={(e) => setHtmlOverride(e.target.value)}
              disabled={!canWrite}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          )}
        </div>

        <div>
          <button className="btn btn-primary" type="submit" disabled={!canWrite}>
            Guardar plantilla visual
          </button>
        </div>
      </form>

      <TemplatePreview
        id="vista-plantilla"
        html={previewHtml}
        title="Vista previa"
        subtitle="Renderizado con datos de ejemplo"
      />
    </section>
  );
}
