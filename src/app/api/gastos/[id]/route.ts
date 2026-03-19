import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, canWrite } from '@/src/lib/auth';
import { withStore, withStoreWrite } from '@/src/lib/store';
import { appendEvent } from '@/src/lib/audit';
import type { ExpenseCategory } from '@/src/lib/types';

const VALID_CATEGORIES: ExpenseCategory[] = [
  'PEAJE', 'GASOLINA', 'COMIDA', 'PARKING', 'LAVADO', 'OTRO',
];

// GET /api/gastos/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const expense = withStore((store) => store.expenses.find((e) => e.id === id));
  if (!expense) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ expense });
}

// PUT /api/gastos/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      details: { action: 'UPDATE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { plate, category, amount, worker, contractId, notes, date } = body as {
      plate?: string;
      category?: ExpenseCategory;
      amount?: number;
      worker?: string;
      contractId?: string;
      notes?: string;
      date?: string;
    };

    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Categoría inválida: ${category}` }, { status: 400 });
    }
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json({ error: 'El importe debe ser un número positivo' }, { status: 400 });
    }

    const updated = withStoreWrite((store) => {
      const idx = store.expenses.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error('NOT_FOUND');

      const expense = store.expenses[idx];

      if (plate) {
        const activePlates = new Set(
          store.vehicles.filter((v) => v.active).map((v) => v.plate.toUpperCase())
        );
        if (!activePlates.has(plate.toUpperCase())) {
          throw new Error(`Matrícula no activa en flota: ${plate}`);
        }
        expense.plate = plate.toUpperCase();
      }

      if (category) expense.category = category;
      if (amount !== undefined) expense.amount = amount;
      if (worker !== undefined) expense.worker = worker || undefined;
      if (contractId !== undefined) expense.contractId = contractId || undefined;
      if (notes !== undefined) expense.notes = notes || undefined;
      if (date) expense.date = date;
      expense.updatedAt = new Date().toISOString();

      return expense;
    });

    await appendEvent({
      action: 'SYSTEM',
      actorId: session.userId,
      actorRole: session.role,
      entity: 'DailyExpense',
      entityId: id,
      details: { action: 'UPDATE' },
    });

    return NextResponse.json({ expense: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno';
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }
    console.error('[gastos PUT] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/gastos/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      details: { action: 'DELETE' },
    });
    return NextResponse.json({ error: 'Sin permisos de escritura' }, { status: 403 });
  }

  const { id } = await params;

  const deleted = withStoreWrite((store) => {
    const idx = store.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const [removed] = store.expenses.splice(idx, 1);
    return removed;
  });

  if (!deleted) {
    return NextResponse.json({ error: 'Gasto no encontrado' }, { status: 404 });
  }

  await appendEvent({
    action: 'SYSTEM',
    actorId: session.userId,
    actorRole: session.role,
    entity: 'DailyExpense',
    entityId: id,
    details: { action: 'DELETE', plate: deleted.plate, date: deleted.date, amount: deleted.amount },
  });

  return NextResponse.json({ ok: true });
}
