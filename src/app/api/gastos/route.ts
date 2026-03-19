import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite, generateId } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { DailyExpense, ExpenseCategory } from '@/src/lib/types';

const VALID_CATEGORIES: ExpenseCategory[] = [
  'PEAJE', 'GASOLINA', 'COMIDA', 'PARKING', 'LAVADO', 'OTRO',
];

// GET /api/gastos
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filterDate = searchParams.get('date') ?? '';
  const filterPlate = searchParams.get('plate') ?? '';
  const filterCategory = searchParams.get('category') ?? '';
  const filterWorker = searchParams.get('worker') ?? '';
  const filterFrom = searchParams.get('from') ?? '';
  const filterTo = searchParams.get('to') ?? '';
  const filterBatch = searchParams.get('batchId') ?? '';

  const expenses = withStore((store) => {
    let list = [...store.expenses];

    if (filterDate) list = list.filter((e) => e.date === filterDate);
    if (filterFrom) list = list.filter((e) => e.date >= filterFrom);
    if (filterTo) list = list.filter((e) => e.date <= filterTo);
    if (filterPlate) list = list.filter((e) => e.plate.toUpperCase().includes(filterPlate.toUpperCase()));
    if (filterCategory) list = list.filter((e) => e.category === filterCategory);
    if (filterWorker) list = list.filter((e) => (e.worker ?? '').toLowerCase().includes(filterWorker.toLowerCase()));
    if (filterBatch) list = list.filter((e) => e.batchId === filterBatch);

    // Sort by date desc, then createdAt desc
    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });

    return list;
  });

  return NextResponse.json({ expenses });
}

// POST /api/gastos
// Body: { date: string, items: { plate, category, amount, worker?, contractId?, notes? }[] }
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!canWrite(session.role)) {
    await appendEvent({
      action: 'RBAC_DENIED',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'DailyExpense',
      details: { action: 'CREATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { date, items } = body as {
      date: string;
      items: {
        plate: string;
        category: ExpenseCategory;
        amount: number;
        worker?: string;
        contractId?: string;
        notes?: string;
      }[];
    };

    if (!date || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: date, items' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.plate) {
        return NextResponse.json({ error: 'Cada gasto necesita matrícula' }, { status: 400 });
      }
      if (!item.category || !VALID_CATEGORIES.includes(item.category)) {
        return NextResponse.json(
          { error: `Categoría inválida: ${item.category}. Válidas: ${VALID_CATEGORIES.join(', ')}` },
          { status: 400 }
        );
      }
      if (typeof item.amount !== 'number' || item.amount <= 0) {
        return NextResponse.json({ error: 'El importe debe ser un número positivo' }, { status: 400 });
      }
    }

    const batchId = generateId();
    const now = new Date().toISOString();

    const created = withStoreWrite((store) => {
      // Validate: plates must exist as active vehicles in the store
      const activePlates = new Set(
        store.vehicles
          .filter((v) => v.active)
          .map((v) => v.plate.toUpperCase())
      );

      for (const item of items) {
        if (!activePlates.has(item.plate.toUpperCase())) {
          throw new Error(`Matrícula no activa en flota: ${item.plate}`);
        }
      }

      const newExpenses: DailyExpense[] = items.map((item) => ({
        id: generateId(),
        batchId,
        date,
        plate: item.plate.toUpperCase(),
        category: item.category,
        amount: item.amount,
        worker: item.worker,
        contractId: item.contractId,
        notes: item.notes,
        createdBy: session.userId,
        createdAt: now,
        updatedAt: now,
      }));

      store.expenses.push(...newExpenses);
      return newExpenses;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'DailyExpense',
      details: {
        action: 'CREATE_BATCH',
        batchId,
        date,
        count: created.length,
        total: created.reduce((s, e) => s + e.amount, 0),
      },
    });

    return NextResponse.json({ expenses: created, batchId }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    console.error('[gastos POST] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
