import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';

// GET /api/locations — lugares de entrega/recogida configurados (cualquier usuario autenticado)
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const locations = withStore((store) => store.settings.deliveryLocations ?? []);
  return NextResponse.json({ locations });
}
