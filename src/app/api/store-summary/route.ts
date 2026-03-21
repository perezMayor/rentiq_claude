import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/lib/auth';
import { withStore } from '@/src/lib/store';

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Year for monthly stats
  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(now.getFullYear()), 10);
  const prevFrom = req.nextUrl.searchParams.get('from') ?? today;
  const prevTo   = req.nextUrl.searchParams.get('to')   ?? today;

  const summary = withStore((store) => {
    const activeContracts = store.contracts.filter((c) => c.status === 'ABIERTO');
    const activeVehicles = store.vehicles.filter((v) => v.active);
    const flotaActiva = activeVehicles.length;

    // ─── Top KPIs ────────────────────────────────────────────────────────────

    const entregasHoyContratos = activeContracts.filter(
      (c) => c.startDate?.slice(0, 10) === today && !c.checkout
    );
    const entregasHoy = entregasHoyContratos.length;

    const clientMap = Object.fromEntries(
      store.clients.map((c) => [c.id, `${c.name}${c.surname ? ' ' + c.surname : ''}`])
    );

    const entregasDetalle = entregasHoyContratos.map((c) => ({
      lugar: c.pickupLocation ?? '—',
      fecha: c.startDate?.slice(0, 10) ?? '—',
      hora:  c.startTime ?? '—',
      nombre: clientMap[c.clientId] ?? c.clientId,
      coche: c.plate ?? '—',
    }));

    const recogidasHoy = activeContracts.filter(
      (c) => c.endDate?.slice(0, 10) === today && c.checkout && !c.checkin
    ).length;

    const facturasBorradorList = store.invoices.filter((i) => i.status === 'BORRADOR');
    const vencidosPendienteList = activeContracts.filter(
      (c) => c.endDate?.slice(0, 10) < today && c.checkout && !c.checkin
    );
    const facturasBorrador = facturasBorradorList.length;
    const vencidosPendiente = vencidosPendienteList.length;
    const tareasPendientes = facturasBorrador + vencidosPendiente;

    const facturasBorradorDetalle: string[] = facturasBorradorList.map((inv) => {
      const contrato = store.contracts.find((c) => c.id === inv.contractId);
      const cliente = contrato ? (clientMap[contrato.clientId] ?? contrato.clientId) : '—';
      return `Factura ${inv.number} pendiente — ${cliente} — ${inv.total.toFixed(2)} €`;
    });

    const recogidaVencidaDetalle: string[] = vencidosPendienteList.map((c) => {
      const cliente = clientMap[c.clientId] ?? c.clientId;
      return `${c.number} — ${cliente} — ${c.plate} — venció ${c.endDate?.slice(0, 10)}`;
    });

    // ─── Agenda ──────────────────────────────────────────────────────────────

    const reservasHoy = store.reservations.filter(
      (r) => r.startDate?.slice(0, 10) === today && r.status !== 'CANCELADA'
    ).length;

    const contratosAbiertos = activeContracts.length;

    const reservasSinConfirmar = store.reservations.filter(
      (r) => r.status === 'PETICION'
    ).length;

    // Huérfanas: CONFIRMADA sin contrato y con startDate en el pasado
    const reservasHuerfanas = store.reservations.filter(
      (r) => r.status === 'CONFIRMADA' && !r.contractId && r.startDate?.slice(0, 10) < today
    ).length;

    // Sin matrícula: contratos sin plate asignada (edge case)
    const contratosSinMatricula = activeContracts.filter((c) => !c.plate).length;

    // Entregas hoy sin contrato: reservas hoy que no se convirtieron en contrato
    const entregasHoySinContrato = store.reservations.filter(
      (r) => r.startDate?.slice(0, 10) === today && !r.contractId && r.status !== 'CANCELADA'
    ).length;

    // Ocupación flota hoy: vehículos con contrato activo hoy / flota total
    const vehiculosOcupados = activeVehicles.filter((v) =>
      activeContracts.some(
        (c) => c.plate === v.plate && c.startDate <= today && c.endDate >= today
      )
    ).length;
    const ocupacionFlota = flotaActiva > 0 ? Math.round((vehiculosOcupados / flotaActiva) * 100) : 0;

    // Ratio confirmación/petición
    const totalActivas = store.reservations.filter(
      (r) => r.status === 'PETICION' || r.status === 'CONFIRMADA'
    ).length;
    const confirmadas = store.reservations.filter((r) => r.status === 'CONFIRMADA').length;
    const ratioConfirmacion = totalActivas > 0 ? Math.round((confirmadas / totalActivas) * 100) : 0;

    // Movimientos próximas 24h
    const movimientosPr24h = activeContracts.filter(
      (c) =>
        (c.startDate?.slice(0, 10) >= today && c.startDate?.slice(0, 10) <= in24h) ||
        (c.endDate?.slice(0, 10) >= today && c.endDate?.slice(0, 10) <= in24h)
    ).length;

    // Grupos con déficit: categorías donde vehículos ocupados >= vehículos disponibles
    const gruposDeficit = store.vehicleCategories.filter((cat) => {
      const catVehicles = activeVehicles.filter((v) => v.categoryId === cat.id);
      const catOcupados = catVehicles.filter((v) =>
        activeContracts.some(
          (c) => c.plate === v.plate && c.startDate <= today && c.endDate >= today
        )
      ).length;
      return catOcupados >= catVehicles.length && catVehicles.length > 0;
    }).length;

    // ─── Monthly stats ────────────────────────────────────────────────────────

    const monthlyEntregas = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const prefix = `${year}-${m}`;
      return store.contracts.filter(
        (c) => c.startDate?.startsWith(prefix)
      ).length;
    });

    const monthlyReservas = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const prefix = `${year}-${m}`;
      return store.reservations.filter(
        (r) => r.startDate?.startsWith(prefix) && r.status !== 'CANCELADA'
      ).length;
    });

    // ─── Previsión por categoría (rango from/to) ─────────────────────────────

    const categorias = store.vehicleCategories
      .filter((c) => c.active)
      .map((cat) => {
        const catVehicles = activeVehicles.filter((v) => v.categoryId === cat.id);
        const total = catVehicles.length;
        // Un vehículo está ocupado si tiene algún contrato (no cancelado) que
        // solapa con el rango consultado: startDate <= prevTo && endDate >= prevFrom
        const ocupados = catVehicles.filter((v) =>
          store.contracts.some(
            (c) =>
              c.status !== 'CANCELADO' &&
              c.plate === v.plate &&
              c.startDate <= prevTo &&
              c.endDate   >= prevFrom
          )
        ).length;
        return {
          id: cat.id,
          code: cat.code,
          name: cat.name,
          total,
          ocupados,
          saldo: total - ocupados,
        };
      })
      .filter((c) => c.total > 0);

    const saldoGlobal = categorias.reduce((sum, c) => sum + c.saldo, 0);

    return {
      // Top KPIs
      entregasHoy,
      entregasDetalle,
      tareasPendientes,
      recogidasHoy,
      facturasBorrador,
      facturasBorradorDetalle,
      recogidaVencidaCount: vencidosPendiente,
      recogidaVencidaDetalle,
      // Agenda
      reservasHoy,
      contratosAbiertos,
      reservasSinConfirmar,
      reservasHuerfanas,
      contratosSinMatricula,
      entregasHoySinContrato,
      ocupacionFlota,
      ratioConfirmacion,
      movimientosPr24h,
      gruposDeficit,
      flotaActiva,
      // Monthly
      monthly: { entregas: monthlyEntregas, reservas: monthlyReservas },
      // Previsión
      categorias,
      saldoGlobal,
    };
  });

  return NextResponse.json(summary);
}
