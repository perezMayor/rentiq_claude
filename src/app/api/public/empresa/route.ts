import { NextResponse } from 'next/server';
import { readStore } from '@/src/lib/store';

// GET /api/public/empresa — sin autenticación, solo datos mínimos para la pantalla de login
export async function GET() {
  const store = readStore();
  const branches = store.branches
    .filter((b) => b.active)
    .map((b) => ({ id: b.id, name: b.name }));

  return NextResponse.json({
    companyName: store.settings.name,
    branches,
    defaultBranchId: store.settings.defaultBranchId,
  });
}
