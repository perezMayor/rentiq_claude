import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSessionFromRequest } from '@/src/lib/auth';
import { appendEvent } from '@/src/lib/audit';

const DATA_DIR = process.env.RENTIQ_DATA_DIR ?? './.rentiq-v3-data';
const STORE_FILE = path.join(DATA_DIR, 'rental-store.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// GET /api/backups — list backup files
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  ensureBackupsDir();

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((name) => {
      const fullPath = path.join(BACKUPS_DIR, name);
      const stat = fs.statSync(fullPath);
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ backups: files });
}

// POST /api/backups — create a backup
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  if (!fs.existsSync(STORE_FILE)) {
    return NextResponse.json({ error: 'No se encontró el archivo de datos' }, { status: 500 });
  }

  ensureBackupsDir();

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `backup-${ts}.json`;
  const backupPath = path.join(BACKUPS_DIR, backupName);

  fs.copyFileSync(STORE_FILE, backupPath);

  await appendEvent({
    action: 'SYSTEM',
    actorId: session.userId,
    actorRole: session.role,
    entity: 'Backup',
    details: { action: 'CREATE', file: backupName },
  });

  const stat = fs.statSync(backupPath);
  return NextResponse.json({ backup: { name: backupName, size: stat.size, createdAt: stat.mtime.toISOString() } }, { status: 201 });
}
