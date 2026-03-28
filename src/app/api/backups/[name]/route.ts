import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSessionFromRequest } from '@/src/lib/auth';
import { appendEvent } from '@/src/lib/audit';

const DATA_DIR = process.env.RENTIQ_DATA_DIR ?? './.rentiq-v3-data';
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// GET /api/backups/[name] — download a backup file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { name } = await params;
  if (!name.endsWith('.json') || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: 'Nombre de archivo no válido' }, { status: 400 });
  }

  const filePath = path.join(BACKUPS_DIR, name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Backup no encontrado' }, { status: 404 });
  }

  const content = fs.readFileSync(filePath);
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}

// DELETE /api/backups/[name] — delete a backup file
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Solo SUPER_ADMIN puede eliminar backups' }, { status: 403 });
  }

  const { name } = await params;
  if (!name.endsWith('.json') || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: 'Nombre de archivo no válido' }, { status: 400 });
  }

  const filePath = path.join(BACKUPS_DIR, name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Backup no encontrado' }, { status: 404 });
  }

  fs.unlinkSync(filePath);

  await appendEvent({
    action: 'SYSTEM',
    actorId: session.userId,
    actorRole: session.role,
    entity: 'Backup',
    details: { action: 'DELETE', file: name },
  });

  return NextResponse.json({ ok: true });
}
