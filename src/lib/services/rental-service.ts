import 'server-only';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { TemplateDocument, UserRole } from '@/src/lib/types';

type Actor = { id: string; role: UserRole | string };

// ── Company Settings ────────────────────────────────────────────────────────

export async function getCompanySettings() {
  return withStore((store) => ({ ...store.settings }));
}

export async function updateCompanySettings(
  input: Record<string, string>,
  actor: Actor,
): Promise<void> {
  withStoreWrite((store) => {
    const s = store.settings as unknown as Record<string, unknown>;
    const str = (k: string) => { if (input[k] !== undefined) s[k] = String(input[k]); };
    const num = (k: string) => {
      if (input[k] !== undefined) {
        const n = parseFloat(input[k]);
        s[k] = isNaN(n) ? undefined : n;
      }
    };
    str('documentName'); str('legalName'); str('documentBrandName');
    str('taxId'); str('fiscalAddress'); str('companyEmailFrom');
    str('companyPhone'); str('companyWebsite'); str('documentFooter');
    str('logoDataUrl'); str('brandPrimaryColor'); str('brandSecondaryColor');
    str('contractBackLayout'); str('contractBackContentType');
    str('contractBackContentEs'); str('contractBackContentEn'); str('contractBackContent');
    num('contractBackFontSize');
  });
  await appendEvent({
    action: 'SYSTEM',
    actorId: actor.id,
    actorRole: actor.role as UserRole,
    entity: 'CompanySettings',
    details: { action: 'UPDATE_DOCUMENT_SETTINGS' },
  });
}

// ── Templates ───────────────────────────────────────────────────────────────

export async function listTemplates(_query: string): Promise<TemplateDocument[]> {
  return withStore((store) => [...(store.templates ?? [])]);
}

export async function createTemplate(
  input: Record<string, string>,
  actor: Actor,
): Promise<TemplateDocument> {
  const templateCode = String(input.templateCode ?? '').trim().toUpperCase();
  const templateType = String(input.templateType ?? 'CONTRATO').trim().toUpperCase() as TemplateDocument['templateType'];
  const language = String(input.language ?? 'es').trim().toLowerCase();
  const title = String(input.title ?? templateCode).trim();
  const htmlContent = String(input.htmlContent ?? '').trim();
  const templateFunction = String(input.templateFunction ?? '').trim();

  if (!templateCode) throw new Error('El código de plantilla es obligatorio');
  if (!['CONTRATO', 'CONFIRMACION_RESERVA', 'PRESUPUESTO', 'FACTURA'].includes(templateType)) {
    throw new Error('Tipo de plantilla no válido');
  }

  const now = new Date().toISOString();
  const template: TemplateDocument = {
    id: generateId(),
    templateCode,
    templateType,
    language,
    title: title || templateCode,
    templateFunction: templateFunction || undefined,
    htmlContent,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  withStoreWrite((store) => {
    if (!store.templates) store.templates = [];
    store.templates.push(template);
  });

  await appendEvent({
    action: 'SYSTEM',
    actorId: actor.id,
    actorRole: actor.role as UserRole,
    entity: 'TemplateDocument',
    entityId: template.id,
    details: { action: 'CREATE', templateCode },
  });

  return template;
}

export async function updateTemplate(
  input: Record<string, string>,
  actor: Actor,
): Promise<TemplateDocument> {
  const templateId = String(input.templateId ?? '').trim();
  if (!templateId) throw new Error('ID de plantilla requerido');

  const updated = withStoreWrite((store) => {
    if (!store.templates) store.templates = [];
    const idx = store.templates.findIndex((t) => t.id === templateId);
    if (idx === -1) throw new Error('Plantilla no encontrada');
    const t = store.templates[idx];
    if (input.title !== undefined) t.title = String(input.title).trim() || t.title;
    if (input.htmlContent !== undefined) t.htmlContent = String(input.htmlContent);
    if (input.templateFunction !== undefined) t.templateFunction = String(input.templateFunction) || undefined;
    if (input.active !== undefined) t.active = input.active === 'true';
    if (input.templateCode !== undefined) t.templateCode = String(input.templateCode).trim().toUpperCase() || t.templateCode;
    t.updatedAt = new Date().toISOString();
    return { ...t };
  });

  await appendEvent({
    action: 'SYSTEM',
    actorId: actor.id,
    actorRole: actor.role as UserRole,
    entity: 'TemplateDocument',
    entityId: templateId,
    details: { action: 'UPDATE' },
  });

  return updated;
}

export async function deleteTemplate(
  templateId: string,
  actor: Actor,
): Promise<void> {
  withStoreWrite((store) => {
    if (!store.templates) store.templates = [];
    const idx = store.templates.findIndex((t) => t.id === templateId);
    if (idx === -1) throw new Error('Plantilla no encontrada');
    store.templates.splice(idx, 1);
  });

  await appendEvent({
    action: 'SYSTEM',
    actorId: actor.id,
    actorRole: actor.role as UserRole,
    entity: 'TemplateDocument',
    entityId: templateId,
    details: { action: 'DELETE' },
  });
}
