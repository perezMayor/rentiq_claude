import { redirect } from 'next/navigation';
import { getSessionUser, canWrite } from '@/src/lib/auth';
import { getActionErrorMessage } from '@/src/lib/action-errors';
import {
  getCompanySettings,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  updateCompanySettings,
} from '@/src/lib/services/rental-service';
import { decodeVisualTemplateConfig, buildVisualTemplateHtml, defaultVisualTemplateConfig, type VisualTemplateType, type VisualTemplateConfig } from '@/src/lib/services/template-visual-builder';
import type { TemplateFunctionName } from '@/src/lib/services/template-function-catalog';
import { TEMPLATE_MACRO_GROUPS } from '@/src/lib/services/template-macro-catalog';
import { TemplateSelectorForm } from './template-selector-form';
import { TemplatePreview } from './template-preview';
import { TemplateDownloadButton } from './template-download-button';
import { TemplateScrollButton } from './template-scroll-button';
import { VisualTemplateEditor } from './visual-template-editor';
import { NewTemplateEditor } from './new-template-editor';

// ── Constants ────────────────────────────────────────────────────────────────

const CONTRACT_REVERSE_CODE = 'REVERSO_CONTRATO';

const VISUAL_TEMPLATE_TYPES: VisualTemplateType[] = ['CONFIRMACION_RESERVA', 'PRESUPUESTO', 'FACTURA'];

function isVisualTemplateType(t: string): t is VisualTemplateType {
  return VISUAL_TEMPLATE_TYPES.includes(t as VisualTemplateType);
}

// ── Sample preview data ───────────────────────────────────────────────────────

function buildSamplePreviewData(language: string): Record<string, string> {
  const isEn = language.toLowerCase().startsWith('en');
  return {
    company_name: 'RentIQ Alquiler SL',
    company_document_name: 'RentIQ Alquiler',
    company_tax_id: 'B12345678',
    company_fiscal_address: 'Calle Mayor 1, 28001 Madrid',
    company_phone: '+34 91 000 00 00',
    company_email_from: 'info@rentiq.es',
    company_website: 'www.rentiq.es',
    company_document_footer: 'RentIQ Alquiler SL · B12345678 · Calle Mayor 1, 28001 Madrid',
    company_logo_data_url: '',
    company_brand_primary_color: '#2563eb',
    company_brand_secondary_color: '#0f172a',
    customer_name: isEn ? 'John Smith' : 'Juan García López',
    customer_first_name: isEn ? 'John' : 'Juan',
    customer_email: isEn ? 'john.smith@email.com' : 'juan.garcia@email.com',
    customer_phone: '+34 600 000 000',
    customer_tax_id: isEn ? 'GB123456A' : 'DNI 12345678A',
    customer_address: isEn ? '10 London Road, London' : 'Calle Ejemplo 10, Madrid',
    customer_city: isEn ? 'London' : 'Madrid',
    customer_province: isEn ? 'Greater London' : 'Madrid',
    customer_country: isEn ? 'United Kingdom' : 'España',
    customer_postal_code: isEn ? 'SW1A 1AA' : '28001',
    customer_driving_license: isEn ? 'SMITH123456' : 'B-12345678',
    customer_document_type: isEn ? 'Passport' : 'DNI',
    customer_document_number: isEn ? 'GB123456' : '12345678A',
    customer_nationality: isEn ? 'British' : 'Española',
    reservation_number: 'RSV-2026-000042',
    reservation_status: isEn ? 'CONFIRMED' : 'CONFIRMADA',
    delivery_place: isEn ? 'Malaga Airport T3' : 'Aeropuerto Málaga T3',
    delivery_date: isEn ? '04/04/2026' : '04/04/2026',
    delivery_time: '10:30',
    delivery_flight: isEn ? 'BA2490' : 'IB3456',
    pickup_place: isEn ? 'Malaga Airport T3' : 'Aeropuerto Málaga T3',
    pickup_date: isEn ? '11/04/2026' : '11/04/2026',
    pickup_time: '18:00',
    pickup_flight: isEn ? 'BA2491' : 'IB3457',
    billed_car_group: isEn ? 'Group C — Compact' : 'Grupo C — Compacto',
    assigned_plate: isEn ? 'To be assigned' : 'Por asignar',
    billed_days: '7',
    applied_rate: isEn ? 'Standard 7d' : 'Estándar 7d',
    base_amount: '245,00',
    extras_amount: '49,00',
    insurance_amount: '70,00',
    fuel_amount: '0,00',
    discount_amount: '0,00',
    total_price: '364,00',
    total_amount: '364,00',
    extras_breakdown: isEn ? 'GPS x7d: 35,00€ · Child seat x7d: 14,00€' : 'GPS x7d: 35,00€ · Silla niño x7d: 14,00€',
    deductible: '500,00',
    deposit_amount: '300,00',
    public_observations: isEn ? 'Please bring your driving license and passport.' : 'Por favor traiga su permiso de conducir y DNI.',
    payments_made: '0,00',
    iva_percent: '21',
    // Invoice fields
    invoice_number: 'F-MAL-26-000007',
    issued_at: isEn ? '11/04/2026' : '11/04/2026',
    contract_number: 'MAL-26-000042',
    driver_name: isEn ? 'John Smith' : 'Juan García López',
    rental_period_detail: isEn ? '04/04/2026 → 11/04/2026 (7 days)' : '04/04/2026 → 11/04/2026 (7 días)',
    vehicle_detail: isEn ? 'Compact — 1234ABC' : 'Compacto — 1234ABC',
    vehicle_occupation_amount: '245,00',
    penalties_amount: '0,00',
    iva_amount: '76,44',
  };
}

// ── Server Actions ────────────────────────────────────────────────────────────

async function handleSaveTemplate(formData: FormData): Promise<void> {
  'use server';
  const user = await getSessionUser();
  if (!user || !canWrite(user.role)) return;

  const templateId = formData.get('templateId') as string | null;
  const saveSource = (formData.get('saveSource') as string) || 'html';

  try {
    let finalHtml = (formData.get('htmlContent') as string | null) || '';

    // If visual mode, rebuild from visual config hidden fields
    if (saveSource === 'visual') {
      const templateType = (formData.get('templateType') as string | null) || '';
      const language = (formData.get('language') as string | null) || 'es';
      if (isVisualTemplateType(templateType)) {
        const cfg: VisualTemplateConfig = {
          title: (formData.get('visualTitle') as string) || '',
          intro: (formData.get('visualIntro') as string) || '',
          footer: (formData.get('visualFooter') as string) || '',
          additionalText: (formData.get('visualAdditionalText') as string) || '',
          showCompany: formData.get('showCompany') === 'true',
          showReservationBlock: formData.get('showReservationBlock') === 'true',
          showBaseData: formData.get('showBaseData') === 'true',
          showPricingBlock: formData.get('showPricingBlock') === 'true',
          showExtrasTable: formData.get('showExtrasTable') === 'true',
          showObservations: formData.get('showObservations') === 'true',
          showAdditionalText: formData.get('showAdditionalText') === 'true',
        };
        const settings = await getCompanySettings();
        finalHtml = buildVisualTemplateHtml(templateType, language, cfg, {
          primaryColor: settings.brandPrimaryColor,
          secondaryColor: settings.brandSecondaryColor,
        });
      }
    }

    const input: Record<string, string> = {
      templateCode: (formData.get('templateCode') as string | null) || '',
      templateType: (formData.get('templateType') as string | null) || '',
      language: (formData.get('language') as string | null) || 'es',
      title: (formData.get('title') as string | null) || '',
      templateFunction: (formData.get('templateFunction') as string | null) || '',
      active: (formData.get('active') as string | null) || 'true',
      htmlContent: finalHtml,
    };

    if (templateId) {
      input.templateId = templateId;
      await updateTemplate(input, user);
    } else {
      await createTemplate(input, user);
    }
  } catch (err) {
    // errors surface in UI via redirect with error param (best-effort)
    console.error('[plantillas] save error:', getActionErrorMessage(err, 'Error al guardar'));
  }
}

async function handleDeleteTemplate(formData: FormData): Promise<void> {
  'use server';
  const user = await getSessionUser();
  if (!user || !canWrite(user.role)) return;
  const templateId = formData.get('templateId') as string | null;
  if (!templateId) return;
  try {
    await deleteTemplate(templateId, user);
  } catch (err) {
    console.error('[plantillas] delete error:', getActionErrorMessage(err, 'Error al eliminar'));
  }
  redirect('/plantillas');
}

async function handleInitBaseTemplates(): Promise<void> {
  'use server';
  const user = await getSessionUser();
  if (!user || !canWrite(user.role)) return;

  const BASE_TEMPLATES: Array<{ code: string; type: VisualTemplateType; lang: string; title: string }> = [
    { code: 'CONF_RES_ES_BASE', type: 'CONFIRMACION_RESERVA', lang: 'es', title: 'Confirmación de reserva (ES)' },
    { code: 'CONF_RES_EN_BASE', type: 'CONFIRMACION_RESERVA', lang: 'en', title: 'Reservation confirmation (EN)' },
    { code: 'PRES_BASE_ES',     type: 'PRESUPUESTO',          lang: 'es', title: 'Presupuesto (ES)' },
    { code: 'PRES_BASE_EN',     type: 'PRESUPUESTO',          lang: 'en', title: 'Quotation (EN)' },
    { code: 'FAC_BASE_ES',      type: 'FACTURA',              lang: 'es', title: 'Factura (ES)' },
    { code: 'FAC_BASE_EN',      type: 'FACTURA',              lang: 'en', title: 'Invoice (EN)' },
  ];

  const [existing, settings] = await Promise.all([listTemplates(''), getCompanySettings()]);
  const existingCodes = new Set(existing.map((t) => t.templateCode));

  for (const tpl of BASE_TEMPLATES) {
    if (existingCodes.has(tpl.code)) continue;
    const cfg = defaultVisualTemplateConfig(tpl.type, tpl.lang);
    const html = buildVisualTemplateHtml(tpl.type, tpl.lang, cfg, {
      primaryColor: settings.brandPrimaryColor,
      secondaryColor: settings.brandSecondaryColor,
    });
    await createTemplate(
      { templateCode: tpl.code, templateType: tpl.type, language: tpl.lang, title: tpl.title, templateFunction: tpl.type, htmlContent: html },
      user,
    );
  }
  redirect('/plantillas?code=CONF_RES_ES_BASE');
}

async function handleSaveContractReverse(formData: FormData): Promise<void> {
  'use server';
  const user = await getSessionUser();
  if (!user || !canWrite(user.role)) return;
  const input: Record<string, string> = {};
  const layout = formData.get('contractBackLayout') as string | null;
  const contentType = formData.get('contractBackContentType') as string | null;
  const fontSize = formData.get('contractBackFontSize') as string | null;
  const contentEs = formData.get('contractBackContentEs') as string | null;
  const contentEn = formData.get('contractBackContentEn') as string | null;
  if (layout) input.contractBackLayout = layout;
  if (contentType) input.contractBackContentType = contentType;
  if (fontSize) input.contractBackFontSize = fontSize;
  if (contentEs !== null) input.contractBackContentEs = contentEs;
  if (contentEn !== null) input.contractBackContentEn = contentEn;
  try {
    await updateCompanySettings(input, user);
  } catch (err) {
    console.error('[plantillas] contract reverse save error:', getActionErrorMessage(err, 'Error al guardar'));
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PlantillasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const userCanWrite = canWrite(user.role);
  const params = await searchParams;
  const mode = typeof params.mode === 'string' ? params.mode : '';
  const selectedCode = typeof params.code === 'string' ? params.code : '';

  const [settings, allTemplates] = await Promise.all([
    getCompanySettings(),
    listTemplates(''),
  ]);

  const brandPrimary = settings.brandPrimaryColor || '#2563eb';
  const brandSecondary = settings.brandSecondaryColor || '#0f172a';

  // Selectable codes: all template codes + REVERSO_CONTRATO
  const templateCodes = allTemplates.map((t) => t.templateCode);
  const selectableCodes = [...new Set([...templateCodes, CONTRACT_REVERSE_CODE])];

  // Determine which template is selected
  const resolvedCode = selectedCode || selectableCodes[0] || CONTRACT_REVERSE_CODE;
  const isContractReverse = resolvedCode === CONTRACT_REVERSE_CODE;
  const isNewMode = mode === 'new';

  const selectedTemplate = allTemplates.find((t) => t.templateCode === resolvedCode) ?? null;

  // Determine if selected template uses visual builder
  const selectedVisualData = selectedTemplate
    ? decodeVisualTemplateConfig(selectedTemplate.htmlContent)
    : null;
  const isVisualTemplate = selectedVisualData !== null;

  const selectedVisualType: VisualTemplateType =
    selectedVisualData?.templateType ??
    (selectedTemplate && isVisualTemplateType(selectedTemplate.templateType)
      ? (selectedTemplate.templateType as VisualTemplateType)
      : 'CONFIRMACION_RESERVA');

  const visualConfig: VisualTemplateConfig =
    selectedVisualData?.config ??
    defaultVisualTemplateConfig(selectedVisualType, selectedTemplate?.language ?? 'es');

  // Preview data map for new-template-editor
  const previewDataMap = {
    CONFIRMACION_RESERVA: {
      es: buildSamplePreviewData('es'),
      en: buildSamplePreviewData('en'),
    },
    PRESUPUESTO: {
      es: buildSamplePreviewData('es'),
      en: buildSamplePreviewData('en'),
    },
    FACTURA: {
      es: buildSamplePreviewData('es'),
      en: buildSamplePreviewData('en'),
    },
  };

  return (
    <div className="templates-shell stack-md">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Plantillas</h1>
          <p className="page-subtitle">Editor de plantillas de documentos</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card templates-toolbar-card">
        <div className="templates-toolbar-main">
          <TemplateSelectorForm selectedCode={resolvedCode} selectableTemplateCodes={selectableCodes} />
          <div className="templates-toolbar-actions">
            {selectedTemplate && (
              <>
                <TemplateDownloadButton
                  fileName={`${selectedTemplate.templateCode}.html`}
                  htmlContent={selectedTemplate.htmlContent}
                />
                <TemplateScrollButton />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Banner: no hay plantillas creadas */}
      {allTemplates.length === 0 && !isNewMode && userCanWrite && (
        <div className="alert" style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong>No hay plantillas de documentos.</strong>
            <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontSize: 13 }}>
              Crea las 6 plantillas base (confirmaciones, presupuestos y facturas) con un solo clic.
            </span>
          </div>
          <form action={handleInitBaseTemplates}>
            <button className="btn btn-primary" type="submit">Crear plantillas base</button>
          </form>
        </div>
      )}

      {/* New template mode */}
      {isNewMode && (
        <NewTemplateEditor
          action={handleSaveTemplate}
          canWrite={userCanWrite}
          defaultType="CONFIRMACION_RESERVA"
          defaultLanguage="es"
          brandPrimaryColor={brandPrimary}
          brandSecondaryColor={brandSecondary}
          previewDataMap={previewDataMap}
        />
      )}

      {/* Contract reverse editor */}
      {!isNewMode && isContractReverse && (
        <section className="card stack-sm">
          <h3>Reverso de contrato</h3>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Contenido que se imprime en el reverso del contrato. Soporta texto plano o HTML.
          </p>
          <form action={handleSaveContractReverse} className="stack-sm">
            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Diseño</span>
                <select
                  className="form-select"
                  name="contractBackLayout"
                  defaultValue={settings.contractBackLayout ?? 'SINGLE'}
                  disabled={!userCanWrite}
                >
                  <option value="SINGLE">Una columna</option>
                  <option value="DUAL">Dos columnas (ES / EN)</option>
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">Tipo de contenido</span>
                <select
                  className="form-select"
                  name="contractBackContentType"
                  defaultValue={settings.contractBackContentType ?? 'TEXT'}
                  disabled={!userCanWrite}
                >
                  <option value="TEXT">Texto plano</option>
                  <option value="HTML">HTML</option>
                </select>
              </label>
              <label className="form-group contract-reverse-font">
                <span className="form-label">Tamaño fuente (px)</span>
                <input
                  className="form-input"
                  name="contractBackFontSize"
                  type="number"
                  min={7}
                  max={18}
                  defaultValue={settings.contractBackFontSize ?? 10}
                  disabled={!userCanWrite}
                />
              </label>
            </div>
            <div className="contract-reverse-editor">
              <label className="form-group">
                <span className="form-label">Contenido (Español)</span>
                <textarea
                  className="form-textarea"
                  name="contractBackContentEs"
                  rows={12}
                  defaultValue={settings.contractBackContentEs ?? ''}
                  disabled={!userCanWrite}
                  style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 200, resize: 'vertical' }}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Contenido (English)</span>
                <textarea
                  className="form-textarea"
                  name="contractBackContentEn"
                  rows={12}
                  defaultValue={settings.contractBackContentEn ?? ''}
                  disabled={!userCanWrite}
                  style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 200, resize: 'vertical' }}
                />
              </label>
            </div>
            {userCanWrite && (
              <div>
                <button className="btn btn-primary" type="submit">
                  Guardar reverso
                </button>
              </div>
            )}
          </form>
        </section>
      )}

      {/* Visual template editor */}
      {!isNewMode && !isContractReverse && selectedTemplate && isVisualTemplate && (
        <VisualTemplateEditor
          key={selectedTemplate.id}
          action={handleSaveTemplate}
          canWrite={userCanWrite}
          selectedTemplateId={selectedTemplate.id}
          selectedTemplateCode={selectedTemplate.templateCode}
          selectedTemplateLanguage={selectedTemplate.language}
          selectedTemplateTitle={selectedTemplate.title}
          selectedTemplateFunction={(selectedTemplate.templateFunction ?? '') as TemplateFunctionName}
          selectedTemplateActive={selectedTemplate.active}
          selectedVisualType={selectedVisualType}
          visualConfig={visualConfig}
          companyName={settings.documentName ?? settings.name}
          companyPhone={settings.companyPhone ?? settings.phone}
          companyEmailFrom={settings.companyEmailFrom ?? settings.email}
          logoDataUrl={settings.logoDataUrl ?? ''}
          brandPrimaryColor={brandPrimary}
          brandSecondaryColor={brandSecondary}
          documentFooter={settings.documentFooter ?? ''}
          selectedHtmlContent={selectedTemplate.htmlContent}
          previewData={buildSamplePreviewData(selectedTemplate.language)}
        />
      )}

      {/* Raw HTML template editor */}
      {!isNewMode && !isContractReverse && selectedTemplate && !isVisualTemplate && (
        <section className="card stack-sm">
          <h3>Editor HTML — {selectedTemplate.templateCode}</h3>
          <form action={handleSaveTemplate} className="stack-sm">
            <input type="hidden" name="templateId" value={selectedTemplate.id} />
            <input type="hidden" name="templateCode" value={selectedTemplate.templateCode} />
            <input type="hidden" name="templateType" value={selectedTemplate.templateType} />
            <input type="hidden" name="language" value={selectedTemplate.language} />
            <input type="hidden" name="saveSource" value="html" />
            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">Título</span>
                <input className="form-input" name="title" defaultValue={selectedTemplate.title} disabled={!userCanWrite} />
              </label>
              <label className="form-group">
                <span className="form-label">Activa</span>
                <select className="form-select" name="active" defaultValue={selectedTemplate.active ? 'true' : 'false'} disabled={!userCanWrite}>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
            </div>
            <label className="form-group">
              <span className="form-label">HTML</span>
              <textarea
                className="form-textarea"
                name="htmlContent"
                rows={18}
                defaultValue={selectedTemplate.htmlContent}
                disabled={!userCanWrite}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </label>
            {userCanWrite && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn btn-primary" type="submit">Guardar</button>
              </div>
            )}
          </form>

          <TemplatePreview
            id="vista-plantilla"
            html={selectedTemplate.htmlContent}
            title="Vista previa"
            subtitle="HTML sin reemplazar macros"
          />
        </section>
      )}

      {/* Delete template */}
      {!isNewMode && !isContractReverse && selectedTemplate && userCanWrite && (
        <section className="card stack-sm">
          <h3 style={{ color: 'var(--color-danger)' }}>Zona de peligro</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Eliminar esta plantilla es una acción permanente e irreversible.
          </p>
          <form action={handleDeleteTemplate}>
            <input type="hidden" name="templateId" value={selectedTemplate.id} />
            <button
              className="btn btn-danger btn-sm"
              type="submit"
            >
              Eliminar plantilla
            </button>
          </form>
        </section>
      )}

      {/* Empty state when no template selected and not in new mode */}
      {!isNewMode && !isContractReverse && !selectedTemplate && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state__icon">📝</div>
            <div className="empty-state__text">
              No hay ninguna plantilla seleccionada. Crea una nueva usando el botón &quot;+ Nueva&quot;.
            </div>
          </div>
        </div>
      )}

      {/* Macro catalog reference */}
      {!isNewMode && (
        <section className="card stack-sm">
          <h3>Catálogo de macros disponibles</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Usa estas macros en tu HTML. Serán reemplazadas por los valores reales al generar el documento.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {TEMPLATE_MACRO_GROUPS.map((group) => (
              <div key={group.key} style={{ background: 'var(--color-surface)', borderRadius: 6, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary)', marginBottom: 8 }}>
                  {group.title}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {group.macros.map((m) => (
                      <tr key={m.macro}>
                        <td style={{ padding: '2px 0', fontFamily: 'monospace', color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                          {m.macro}
                        </td>
                        <td style={{ padding: '2px 0 2px 10px', color: 'var(--color-text-muted)' }}>
                          {m.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
