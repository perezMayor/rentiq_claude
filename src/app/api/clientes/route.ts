import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { Client } from '@/src/lib/types';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const clients = withStore((store) => store.clients);
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!canWrite(session.role)) {
    await appendEvent({ action: 'RBAC_DENIED', actorId: session.userId, actorRole: session.role, entity: 'Client', details: { action: 'CREATE' } });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.name?.toString().trim()) {
      return NextResponse.json({ error: 'El campo nombre es obligatorio' }, { status: 400 });
    }
    if (!body.type || !['PARTICULAR', 'EMPRESA', 'COMISIONISTA'].includes(body.type)) {
      return NextResponse.json({ error: 'Tipo de cliente inválido' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const client = withStoreWrite((store) => {
      // Backward compat: documentNumber <-> nif alias
      const docNumber = body.documentNumber ?? body.nif;
      const c: Client = {
        id: generateId(),
        type: body.type ?? 'PARTICULAR',
        active: body.active !== false,
        createdAt: now,
        updatedAt: now,
        // Personal
        name: body.name,
        surname: body.surname,
        nationality: body.nationality,
        birthPlace: body.birthPlace,
        birthDate: body.birthDate,
        // Document
        documentType: body.documentType,
        documentNumber: docNumber,
        nif: docNumber,                      // alias
        documentIssuePlace: body.documentIssuePlace,
        documentIssueDate: body.documentIssueDate,
        documentExpiryDate: body.documentExpiryDate,
        // License
        licenseNumber: body.licenseNumber,
        licenseType: body.licenseType,
        licenseIssuePlace: body.licenseIssuePlace,
        licenseIssueDate: body.licenseIssueDate,
        licenseExpiry: body.licenseExpiry,
        // Contact
        phone: body.phone,
        phone2: body.phone2,
        email: body.email,
        preferredLanguage: body.preferredLanguage ?? 'es',
        // Addresses
        address: body.address ?? body.mainAddress?.street,
        city: body.city ?? body.mainAddress?.city,
        postCode: body.postCode ?? body.mainAddress?.postCode,
        country: body.country ?? body.mainAddress?.country,
        mainAddress: body.mainAddress,
        localAddress: body.localAddress,
        // Payment & notes
        paymentMethod: body.paymentMethod,
        notes: body.notes,
        alerts: body.alerts,
        // Company link
        companyId: body.companyId,
        // EMPRESA
        companyName: body.companyName,
        driverIds: body.driverIds,
        // COMISIONISTA
        commissionPercent: body.commissionPercent,
      };
      store.clients.push(c);
      return c;
    });
    await appendEvent({ action: 'SYSTEM', actorId: session.userId, actorRole: session.role, entity: 'Client', entityId: client.id, details: { action: 'CREATE' } });
    return NextResponse.json({ client }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
