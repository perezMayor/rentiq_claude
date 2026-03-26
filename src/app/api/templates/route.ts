import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';

// GET /api/templates
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const templates = withStore((store) => [...(store.templates ?? [])]);
  return NextResponse.json({ templates });
}
