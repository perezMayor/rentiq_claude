import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAdminOrAbove, isSuperAdmin } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';

// GET /api/gestor/empresa
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isAdminOrAbove(session.role)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const settings = withStore((store) => ({ ...store.settings }));
  return NextResponse.json({ settings });
}

// PUT /api/gestor/empresa
export async function PUT(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!isSuperAdmin(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'CompanySettings',
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Solo SUPER_ADMIN puede modificar los datos de empresa' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name, nif, address, phone, email, invoiceSeries, ivaPercent, defaultBranchId,
      deliveryLocations, overlapMinHours, graceHours,
      dayChangeCutoffHour, minReservationDays, minAdvanceHours,
      quoteValidityDays, defaultDeposit,
      nightFeeFromHour, nightFeeToHour, nightFeePrice,
    } = body as {
      name?: string; nif?: string; address?: string; phone?: string; email?: string;
      invoiceSeries?: string; ivaPercent?: number; defaultBranchId?: string;
      deliveryLocations?: string[]; overlapMinHours?: number; graceHours?: number | null;
      dayChangeCutoffHour?: number | null; minReservationDays?: number | null;
      minAdvanceHours?: number | null; quoteValidityDays?: number | null;
      defaultDeposit?: number | null;
      nightFeeFromHour?: number | null; nightFeeToHour?: number | null; nightFeePrice?: number | null;
    };

    const updated = withStoreWrite((store) => {
      if (!store.settings.deliveryLocations) store.settings.deliveryLocations = [];
      if (name) store.settings.name = name;
      if (nif) store.settings.nif = nif;
      if (address) store.settings.address = address;
      if (phone) store.settings.phone = phone;
      if (email) store.settings.email = email;
      if (invoiceSeries) store.settings.invoiceSeries = invoiceSeries;
      if (ivaPercent !== undefined) {
        if (typeof ivaPercent !== 'number' || ivaPercent < 0 || ivaPercent > 100) {
          throw new Error('IVA debe ser un número entre 0 y 100');
        }
        store.settings.ivaPercent = ivaPercent;
      }
      if (defaultBranchId) {
        const branch = store.branches.find((b) => b.id === defaultBranchId);
        if (!branch) throw new Error('Sucursal por defecto no existe');
        store.settings.defaultBranchId = defaultBranchId;
      }
      if (deliveryLocations !== undefined) {
        store.settings.deliveryLocations = deliveryLocations.map((l) => l.trim()).filter(Boolean);
      }
      if (typeof overlapMinHours === 'number' && overlapMinHours >= 0) {
        store.settings.overlapMinHours = overlapMinHours;
      }
      if (graceHours !== undefined) store.settings.graceHours = graceHours ?? undefined;
      if (dayChangeCutoffHour !== undefined) store.settings.dayChangeCutoffHour = dayChangeCutoffHour ?? undefined;
      if (minReservationDays !== undefined) store.settings.minReservationDays = minReservationDays ?? undefined;
      if (minAdvanceHours !== undefined) store.settings.minAdvanceHours = minAdvanceHours ?? undefined;
      if (quoteValidityDays !== undefined) store.settings.quoteValidityDays = quoteValidityDays ?? undefined;
      if (defaultDeposit !== undefined) store.settings.defaultDeposit = defaultDeposit ?? undefined;
      if (nightFeeFromHour !== undefined) store.settings.nightFeeFromHour = nightFeeFromHour ?? undefined;
      if (nightFeeToHour !== undefined) store.settings.nightFeeToHour = nightFeeToHour ?? undefined;
      if (nightFeePrice !== undefined) store.settings.nightFeePrice = nightFeePrice ?? undefined;
      // Branding / document fields
      const s = store.settings as unknown as Record<string, unknown>;
      const strField = (k: string) => { if ((body as Record<string,unknown>)[k] !== undefined) s[k] = String((body as Record<string,unknown>)[k] ?? ''); };
      strField('documentName'); strField('legalName'); strField('documentBrandName');
      strField('taxId'); strField('fiscalAddress'); strField('companyEmailFrom');
      strField('companyPhone'); strField('companyWebsite'); strField('documentFooter');
      strField('logoDataUrl'); strField('brandPrimaryColor'); strField('brandSecondaryColor');
      strField('contractBackLayout'); strField('contractBackContentType');
      strField('contractBackContentEs'); strField('contractBackContentEn'); strField('contractBackContent');
      if ((body as Record<string,unknown>).contractBackFontSize !== undefined) {
        const n = parseFloat(String((body as Record<string,unknown>).contractBackFontSize));
        s['contractBackFontSize'] = isNaN(n) ? undefined : n;
      }
      return { ...store.settings };
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'CompanySettings',
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ settings: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
