'use client';

import { useMemo, useState } from 'react';
import { TEMPLATE_FUNCTION_OPTIONS, type TemplateFunctionName } from '@/src/lib/services/template-function-catalog';
import { renderTemplateWithMacros } from '@/src/lib/services/template-renderer';
import { buildVisualTemplateHtml, defaultVisualTemplateConfig, type VisualTemplateConfig } from '@/src/lib/services/template-visual-builder';
import { TemplatePreview } from './template-preview';

type TemplateType = '' | 'CONTRATO' | 'CONFIRMACION_RESERVA' | 'PRESUPUESTO' | 'FACTURA';
type VisualTemplateType = 'CONFIRMACION_RESERVA' | 'PRESUPUESTO' | 'FACTURA';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  canWrite: boolean;
  defaultType: TemplateType;
  defaultLanguage: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  previewDataMap: Record<VisualTemplateType, Record<string, Record<string, string>>>;
};

function getNeutralHtml(language: string) {
  const isEn = language.toLowerCase().startsWith('en');
  return `<section style="font-family:'Poppins','Segoe UI',Arial,sans-serif;color:#0f172a;max-width:920px;margin:0 auto;padding:18px;"><h2 style="margin:0 0 8px 0;font-size:28px;">${isEn ? 'Template title' : 'Título de la plantilla'}</h2><p style="margin:0;font-size:14px;color:#475569;">${isEn ? 'Write the content of your template here.' : 'Escribe aquí el contenido de tu plantilla.'}</p></section>`.trim();
}

function isVisualType(value: TemplateType): value is VisualTemplateType {
  return value === 'CONFIRMACION_RESERVA' || value === 'PRESUPUESTO' || value === 'FACTURA';
}

export function NewTemplateEditor({
  action,
  canWrite,
  defaultType,
  defaultLanguage,
  brandPrimaryColor,
  brandSecondaryColor,
  previewDataMap,
}: Props) {
  const [templateCode, setTemplateCode] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>(defaultType);
  const [language, setLanguage] = useState(defaultLanguage);
  const [title, setTitle] = useState('');
  const [active] = useState(true);
  const [templateFunction, setTemplateFunction] = useState<TemplateFunctionName>('');
  const [saveSource, setSaveSource] = useState<'visual' | 'html'>('visual');
  const [config, setConfig] = useState<VisualTemplateConfig>(() =>
    defaultVisualTemplateConfig('CONFIRMACION_RESERVA', defaultLanguage),
  );
  const [htmlContent, setHtmlContent] = useState(() =>
    isVisualType(defaultType)
      ? buildVisualTemplateHtml(
          defaultType,
          defaultLanguage,
          defaultVisualTemplateConfig(defaultType, defaultLanguage),
          { primaryColor: brandPrimaryColor, secondaryColor: brandSecondaryColor },
        )
      : getNeutralHtml(defaultLanguage),
  );

  const visual = isVisualType(templateType);

  function rebuildVisual(nextType: VisualTemplateType, nextLang: string, nextConfig: VisualTemplateConfig) {
    return buildVisualTemplateHtml(nextType, nextLang, nextConfig, { primaryColor: brandPrimaryColor, secondaryColor: brandSecondaryColor });
  }

  function handleTypeChange(nextType: TemplateType) {
    setTemplateType(nextType);
    setSaveSource('visual');
    if (isVisualType(nextType)) {
      const nextConfig = defaultVisualTemplateConfig(nextType, language);
      setConfig(nextConfig);
      setHtmlContent(rebuildVisual(nextType, language, nextConfig));
    } else {
      setHtmlContent(getNeutralHtml(language));
    }
  }

  function handleLanguageChange(nextLang: string) {
    setLanguage(nextLang);
    setSaveSource('visual');
    if (isVisualType(templateType)) {
      const nextConfig = defaultVisualTemplateConfig(templateType, nextLang);
      setConfig(nextConfig);
      setHtmlContent(rebuildVisual(templateType, nextLang, nextConfig));
    } else {
      setHtmlContent(getNeutralHtml(nextLang));
    }
  }

  function updateText(key: keyof VisualTemplateConfig, value: string) {
    const next = { ...config, [key]: value };
    setConfig(next);
    setSaveSource('visual');
    if (isVisualType(templateType)) setHtmlContent(rebuildVisual(templateType, language, next));
  }

  function updateBool(key: keyof VisualTemplateConfig, value: boolean) {
    const next = { ...config, [key]: value };
    setConfig(next);
    setSaveSource('visual');
    if (isVisualType(templateType)) setHtmlContent(rebuildVisual(templateType, language, next));
  }

  const previewHtml = useMemo(() => {
    if (!visual) return htmlContent;
    return renderTemplateWithMacros(
      htmlContent,
      (previewDataMap[templateType as VisualTemplateType]?.[language] ?? {}) as Record<string, string>,
    );
  }, [htmlContent, previewDataMap, templateType, language, visual]);

  return (
    <section className="card stack-sm">
      <h3>Nueva plantilla</h3>
      <form action={action} className="stack-sm">
        <input type="hidden" name="saveSource" value={saveSource} />
        {visual && (
          <>
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
          </>
        )}

        <div className="form-grid">
          <label className="form-group">
            <span className="form-label">Código de plantilla</span>
            <input
              className="form-input"
              name="templateCode"
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value.toUpperCase())}
              disabled={!canWrite}
              placeholder="CONF_RES_ES"
              required
            />
          </label>
          <label className="form-group">
            <span className="form-label">Tipo</span>
            <select
              className="form-select"
              name="templateType"
              value={templateType}
              onChange={(e) => handleTypeChange(e.target.value as TemplateType)}
              disabled={!canWrite}
              required
            >
              <option value="">Selecciona tipo</option>
              <option value="CONTRATO">Contrato</option>
              <option value="CONFIRMACION_RESERVA">Confirmación reserva</option>
              <option value="PRESUPUESTO">Presupuesto</option>
              <option value="FACTURA">Factura</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Idioma</span>
            <select
              className="form-select"
              name="language"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={!canWrite}
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Título</span>
            <input
              className="form-input"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canWrite}
              placeholder="Nombre descriptivo"
            />
          </label>
          <label className="form-group">
            <span className="form-label">Función asociada</span>
            <select
              className="form-select"
              name="templateFunction"
              value={templateFunction}
              onChange={(e) => setTemplateFunction(e.target.value as TemplateFunctionName)}
              disabled={!canWrite}
            >
              {TEMPLATE_FUNCTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <input type="hidden" name="active" value={String(active)} />
        </div>

        {visual && (
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
                ['showExtrasTable', 'Info adicional'],
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
        )}

        {!visual && (
          <label className="form-group">
            <span className="form-label">HTML</span>
            <textarea
              className="form-textarea"
              name="htmlContent"
              rows={14}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              disabled={!canWrite}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </label>
        )}

        {visual && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p className="form-label" style={{ margin: 0 }}>HTML manual (avanzado)</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={saveSource === 'html'}
                  onChange={(e) => setSaveSource(e.target.checked ? 'html' : 'visual')}
                  disabled={!canWrite}
                />
                Usar HTML manual
              </label>
            </div>
            {saveSource === 'html' && (
              <textarea
                className="form-textarea"
                name="htmlContent"
                rows={10}
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                disabled={!canWrite}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            )}
          </div>
        )}

        <div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!canWrite || !templateCode || !templateType}
          >
            Crear plantilla
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
