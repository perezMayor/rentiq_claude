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
    const { name, nif, address, phone, email, invoiceSeries, ivaPercent, defaultBranchId } = body as {
      name?: string;
      nif?: string;
      address?: string;
      phone?: string;
      email?: string;
      invoiceSeries?: string;
      ivaPercent?: number;
      defaultBranchId?: string;
    };

    const updated = withStoreWrite((store) => {
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
