import { Prisma } from "@prisma/client";
import type { CajaEvento, MovimientoCaja, TurnoCaja } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CajaError } from "@/lib/caja-errors";
import {
  calcularDiferencia,
  calcularTotalesCaja,
  esTipoMovimientoCaja,
  roundMoney,
  type CajaDashboardDto,
  type CajaEstadoDto,
  type CajaEventoDto,
  type HistorialCajaDto,
  type MovimientoCajaDto,
  type PagoCajaDto,
  type PedidoPorCobrarDto,
  type ReporteCajaDto,
  type TurnoCajaDto,
  type TurnoCajaResumenDto,
} from "@/lib/caja-types";
import type { SessionPayload } from "@/lib/auth/session";

type PagoConPedido = {
  id: number;
  pedidoId: number;
  cajeroNombre: string | null;
  metodo: string;
  monto: Prisma.Decimal;
  referencia: string | null;
  estado: string;
  createdAt: Date;
  pedido: {
    id: number;
    nombreMesero: string | null;
    mesa: { numero: string };
  };
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function nullableNumber(
  value: Prisma.Decimal | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function mapTurno(turno: TurnoCaja, resumenCalculado?: ReturnType<typeof calcularTotalesCaja>): TurnoCajaDto {
  const cerrado = turno.estado === "Cerrado" && turno.efectivoEsperado !== null;

  const totalEfectivo = cerrado
    ? toNumber(turno.totalEfectivo)
    : (resumenCalculado?.totalEfectivo ?? toNumber(turno.totalEfectivo));
  const totalTarjeta = cerrado
    ? toNumber(turno.totalTarjeta)
    : (resumenCalculado?.totalTarjeta ?? toNumber(turno.totalTarjeta));
  const totalBilleteras = cerrado
    ? toNumber(turno.totalBilleteras)
    : (resumenCalculado?.totalBilleteras ?? toNumber(turno.totalBilleteras));
  const totalOtros = cerrado
    ? toNumber(turno.totalOtros)
    : (resumenCalculado?.totalOtros ?? toNumber(turno.totalOtros));
  const totalVentas = cerrado
    ? toNumber(turno.totalVentas)
    : (resumenCalculado?.totalVentas ?? toNumber(turno.totalVentas));

  return {
    id: turno.id,
    cajeroId: turno.cajeroId,
    cajeroNombre: turno.cajeroNombre,
    estado: turno.estado,
    abiertoEn: turno.abiertoEn.toISOString(),
    cerradoEn: turno.cerradoEn?.toISOString() ?? null,
    fondoInicial: toNumber(turno.fondoInicial),
    totalEfectivo,
    totalTarjeta,
    totalBilleteras,
    totalOtros,
    totalVentas,
    totalIngresos: cerrado
      ? toNumber(turno.totalIngresos)
      : (resumenCalculado?.totalIngresos ?? 0),
    totalRetiros: cerrado
      ? toNumber(turno.totalRetiros)
      : (resumenCalculado?.totalRetiros ?? 0),
    totalGastos: cerrado
      ? toNumber(turno.totalGastos)
      : (resumenCalculado?.totalGastos ?? 0),
    efectivoEsperado: cerrado
      ? nullableNumber(turno.efectivoEsperado)
      : (resumenCalculado?.efectivoEsperado ?? null),
    efectivoContado: nullableNumber(turno.efectivoContado),
    diferencia: nullableNumber(turno.diferencia),
    justificacion: turno.justificacion,
    cerradoPorNombre: turno.cerradoPorNombre,
  };
}

function mapPago(pago: PagoConPedido): PagoCajaDto {
  return {
    id: pago.id,
    pedidoId: pago.pedidoId,
    mesaNumero: pago.pedido.mesa.numero,
    meseroNombre: pago.pedido.nombreMesero,
    cajeroNombre: pago.cajeroNombre,
    metodo: pago.metodo,
    monto: toNumber(pago.monto),
    referencia: pago.referencia,
    estado: pago.estado,
    createdAt: pago.createdAt.toISOString(),
  };
}

function mapMovimiento(movimiento: MovimientoCaja): MovimientoCajaDto {
  return {
    id: movimiento.id,
    tipo: movimiento.tipo,
    monto: toNumber(movimiento.monto),
    motivo: movimiento.motivo,
    usuarioNombre: movimiento.usuarioNombre,
    createdAt: movimiento.createdAt.toISOString(),
  };
}

function mapEvento(evento: CajaEvento): CajaEventoDto {
  return {
    id: evento.id,
    tipo: evento.tipo,
    detalle: evento.detalle,
    monto: nullableNumber(evento.monto),
    usuarioNombre: evento.usuarioNombre,
    createdAt: evento.createdAt.toISOString(),
  };
}

async function getPagos(turnoId: number) {
  return prisma.pago.findMany({
    where: { turnoId, estado: { not: "Anulado" } },
    include: {
      pedido: {
        select: {
          id: true,
          nombreMesero: true,
          mesa: { select: { numero: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function getMovimientos(turnoId: number) {
  return prisma.movimientoCaja.findMany({
    where: { turnoId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getTurnoResumen(turnoId: number): Promise<TurnoCajaResumenDto | null> {
  const turno = await prisma.turnoCaja.findUnique({ where: { id: turnoId } });
  if (!turno) return null;

  const [pagos, movimientos] = await Promise.all([
    getPagos(turnoId),
    getMovimientos(turnoId),
  ]);

  const resumen = calcularTotalesCaja(
    pagos.map((pago) => ({ metodo: pago.metodo, monto: toNumber(pago.monto) })),
    movimientos.map((movimiento) => ({
      tipo: movimiento.tipo,
      monto: toNumber(movimiento.monto),
    })),
    toNumber(turno.fondoInicial)
  );

  const pendientesConciliar =
    turno.estado === "Abierto"
      ? pagos.filter((pago) => pago.estado === "Registrado" && pago.metodo !== "Efectivo").length
      : 0;

  return {
    turno: mapTurno(turno, resumen),
    resumen,
    pagos: pagos.map(mapPago),
    movimientos: movimientos.map(mapMovimiento),
    pendientesConciliar,
  };
}

export async function getTurnoActivo(): Promise<TurnoCajaResumenDto | null> {
  const turno = await prisma.turnoCaja.findFirst({
    where: { estado: "Abierto" },
    orderBy: { abiertoEn: "desc" },
    select: { id: true },
  });
  if (!turno) return null;
  return getTurnoResumen(turno.id);
}

export async function getCajaEstado(): Promise<CajaEstadoDto> {
  const turno = await prisma.turnoCaja.findFirst({
    where: { estado: "Abierto" },
    orderBy: { abiertoEn: "desc" },
    select: { id: true, cajeroNombre: true, abiertoEn: true },
  });

  return {
    abierta: Boolean(turno),
    turnoId: turno?.id ?? null,
    cajeroNombre: turno?.cajeroNombre ?? null,
    abiertoEn: turno?.abiertoEn.toISOString() ?? null,
  };
}

export async function getCajaDashboard(): Promise<CajaDashboardDto> {
  const activo = await getTurnoActivo();
  if (activo) {
    return { abierta: true, turno: activo, ultimo: null };
  }

  const ultimo = await prisma.turnoCaja.findFirst({
    where: { estado: "Cerrado" },
    orderBy: { cerradoEn: "desc" },
  });

  return {
    abierta: false,
    turno: null,
    ultimo: ultimo ? mapTurno(ultimo) : null,
  };
}

export async function getHistorialTurnos(
  pageParam: number,
  pageSize = 10
): Promise<HistorialCajaDto> {
  const total = await prisma.turnoCaja.count({ where: { estado: "Cerrado" } });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, pageParam), totalPages);

  const items = await prisma.turnoCaja.findMany({
    where: { estado: "Cerrado" },
    orderBy: { cerradoEn: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: items.map((turno) => mapTurno(turno)),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getReporteTurno(turnoId: number): Promise<ReporteCajaDto | null> {
  const resumen = await getTurnoResumen(turnoId);
  if (!resumen) return null;

  const eventos = await prisma.cajaEvento.findMany({
    where: { turnoId },
    orderBy: { createdAt: "asc" },
  });

  return { ...resumen, eventos: eventos.map(mapEvento) };
}

export async function getPedidosPorCobrar(): Promise<PedidoPorCobrarDto[]> {
  const pedidos = await prisma.pedido.findMany({
    where: { estado: "Pendiente" },
    include: {
      mesa: { select: { numero: true } },
      detalles: {
        include: { producto: { select: { nombre: true } } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { fecha_creacion: "asc" },
  });

  return pedidos
    .filter(
      (pedido) =>
        pedido.detalles.length > 0 &&
        pedido.detalles.every((detalle) => detalle.estado === "Listo")
    )
    .map((pedido) => ({
      id: pedido.id,
      mesaNumero: pedido.mesa.numero,
      meseroNombre: pedido.nombreMesero,
      total: toNumber(pedido.total),
      createdAt: (pedido.fecha_creacion ?? new Date()).toISOString(),
      detalles: pedido.detalles.map((detalle) => ({
        nombre: detalle.producto.nombre,
        cantidad: detalle.cantidad,
      })),
    }));
}

function esConflictoCajaAbierta(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      error.code === "P2002" ||
      error.message.includes("IX_TurnosCaja_UnicoAbierto") ||
      error.message.toLowerCase().includes("duplicate")
    );
  }
  return false;
}

export async function abrirTurno(
  actor: SessionPayload,
  fondoInicial: number
): Promise<TurnoCajaDto> {
  const fondo = roundMoney(Number(fondoInicial));
  if (!Number.isFinite(fondo) || fondo < 0) {
    throw new CajaError(400, "FONDO_INVALIDO", "El fondo inicial debe ser un monto válido.");
  }

  const existente = await prisma.turnoCaja.findFirst({
    where: { estado: "Abierto" },
    select: { id: true, cajeroNombre: true },
  });

  if (existente) {
    throw new CajaError(
      409,
      "CAJA_ABIERTA",
      `Ya hay una caja abierta por ${existente.cajeroNombre}. Ciérrala antes de abrir otra.`,
      { turnoId: existente.id }
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const turno = await tx.turnoCaja.create({
        data: {
          cajeroId: actor.sub,
          cajeroNombre: actor.nombre,
          estado: "Abierto",
          fondoInicial: fondo,
        },
      });

      await tx.cajaEvento.create({
        data: {
          turnoId: turno.id,
          tipo: "Apertura",
          detalle: JSON.stringify({ fondoInicial: fondo }),
          monto: fondo,
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      return mapTurno(turno);
    });
  } catch (error) {
    if (esConflictoCajaAbierta(error)) {
      throw new CajaError(409, "CAJA_ABIERTA", "Ya existe una caja abierta.");
    }
    throw error;
  }
}

export async function registrarMovimiento(
  actor: SessionPayload,
  turnoId: number,
  tipo: unknown,
  monto: unknown,
  motivo: unknown
): Promise<MovimientoCajaDto> {
  if (!Number.isInteger(turnoId) || turnoId <= 0) {
    throw new CajaError(400, "TURNO_INVALIDO", "El turno es inválido.");
  }
  if (!esTipoMovimientoCaja(tipo)) {
    throw new CajaError(400, "TIPO_INVALIDO", "El tipo de movimiento es inválido.");
  }

  const importe = roundMoney(Number(monto));
  if (!Number.isFinite(importe) || importe <= 0) {
    throw new CajaError(400, "MONTO_INVALIDO", "El monto debe ser mayor a cero.");
  }

  const razon = String(motivo ?? "").trim().slice(0, 300);
  if (razon.length < 3) {
    throw new CajaError(400, "MOTIVO_INVALIDO", "Describe el motivo del movimiento.");
  }

  return prisma.$transaction(
    async (tx) => {
      const turno = await tx.turnoCaja.findUnique({
        where: { id: turnoId },
        select: { estado: true },
      });

      if (!turno) throw new CajaError(404, "TURNO_NO_ENCONTRADO", "Turno no encontrado.");
      if (turno.estado !== "Abierto") {
        throw new CajaError(409, "CAJA_CERRADA", "La caja ya está cerrada.");
      }

      const movimiento = await tx.movimientoCaja.create({
        data: {
          turnoId,
          tipo,
          monto: importe,
          motivo: razon,
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      return mapMovimiento(movimiento);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function conciliarPagos(
  actor: SessionPayload,
  turnoId: number,
  pagoIds: unknown
): Promise<{ conciliados: number }> {
  const ids = Array.from(
    new Set(
      (Array.isArray(pagoIds) ? pagoIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  if (ids.length === 0) {
    throw new CajaError(400, "PAGOS_INVALIDOS", "Selecciona al menos un pago para conciliar.");
  }

  return prisma.$transaction(
    async (tx) => {
      const turno = await tx.turnoCaja.findUnique({
        where: { id: turnoId },
        select: { estado: true },
      });

      if (!turno) throw new CajaError(404, "TURNO_NO_ENCONTRADO", "Turno no encontrado.");
      if (turno.estado !== "Abierto") {
        throw new CajaError(409, "CAJA_CERRADA", "La caja ya está cerrada.");
      }

      const pagos = await tx.pago.findMany({
        where: { id: { in: ids }, turnoId },
        select: { id: true, estado: true, metodo: true, monto: true },
      });

      if (pagos.length !== ids.length) {
        throw new CajaError(
          404,
          "PAGOS_NO_ENCONTRADOS",
          "Uno o más pagos no pertenecen al turno indicado."
        );
      }

      if (pagos.some((pago) => pago.estado === "Anulado")) {
        throw new CajaError(400, "PAGO_ANULADO", "No se pueden conciliar pagos anulados.");
      }

      const resultado = await tx.pago.updateMany({
        where: { id: { in: ids }, turnoId, estado: "Registrado" },
        data: {
          estado: "Conciliado",
          conciliadoEn: new Date(),
          conciliadoPorId: actor.sub,
        },
      });

      await tx.cajaEvento.create({
        data: {
          turnoId,
          tipo: "Conciliacion",
          detalle: JSON.stringify({ pagoIds: ids }),
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      return { conciliados: resultado.count };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function cerrarTurno(
  actor: SessionPayload,
  turnoId: number,
  efectivoContado: unknown,
  justificacion: unknown
): Promise<TurnoCajaDto> {
  const contado = roundMoney(Number(efectivoContado));
  if (!Number.isFinite(contado) || contado < 0) {
    throw new CajaError(400, "CONTADO_INVALIDO", "Ingresa un efectivo contado válido.");
  }

  const razon = String(justificacion ?? "").trim().slice(0, 500);

  return prisma.$transaction(
    async (tx) => {
      const turno = await tx.turnoCaja.findUnique({ where: { id: turnoId } });
      if (!turno) throw new CajaError(404, "TURNO_NO_ENCONTRADO", "Turno no encontrado.");
      if (turno.estado !== "Abierto") {
        throw new CajaError(409, "CAJA_CERRADA", "El turno ya está cerrado.");
      }

      const pagos = await tx.pago.findMany({
        where: { turnoId, estado: { not: "Anulado" } },
      });
      const pendientes = pagos.filter(
        (pago) => pago.estado === "Registrado" && pago.metodo !== "Efectivo"
      );

      if (pendientes.length > 0) {
        throw new CajaError(
          409,
          "PAGOS_PENDIENTES",
          `Hay ${pendientes.length} pago(s) electrónico(s) pendiente(s) de conciliar.`,
          {
            pendientes: pendientes.map((pago) => ({
              id: pago.id,
              metodo: pago.metodo,
              monto: Number(pago.monto),
            })),
          }
        );
      }

      const movimientos = await tx.movimientoCaja.findMany({ where: { turnoId } });
      const resumen = calcularTotalesCaja(
        pagos.map((pago) => ({ metodo: pago.metodo, monto: Number(pago.monto) })),
        movimientos.map((movimiento) => ({
          tipo: movimiento.tipo,
          monto: Number(movimiento.monto),
        })),
        Number(turno.fondoInicial)
      );

      const diferencia = calcularDiferencia(contado, resumen.efectivoEsperado);
      if (Math.abs(diferencia) >= 0.01 && !razon) {
        throw new CajaError(
          400,
          "JUSTIFICACION_REQUERIDA",
          "La diferencia requiere una justificación."
        );
      }

      const cerradoEn = new Date();

      await tx.pago.updateMany({
        where: { turnoId, estado: "Registrado", metodo: "Efectivo" },
        data: {
          estado: "Conciliado",
          conciliadoEn: cerradoEn,
          conciliadoPorId: actor.sub,
        },
      });

      const actualizado = await tx.turnoCaja.update({
        where: { id: turnoId },
        data: {
          estado: "Cerrado",
          cerradoEn,
          cerradoPorId: actor.sub,
          cerradoPorNombre: actor.nombre,
          totalEfectivo: resumen.totalEfectivo,
          totalTarjeta: resumen.totalTarjeta,
          totalBilleteras: resumen.totalBilleteras,
          totalOtros: resumen.totalOtros,
          totalVentas: resumen.totalVentas,
          totalIngresos: resumen.totalIngresos,
          totalRetiros: resumen.totalRetiros,
          totalGastos: resumen.totalGastos,
          efectivoEsperado: resumen.efectivoEsperado,
          efectivoContado: contado,
          diferencia,
          justificacion: razon || null,
        },
      });

      await tx.cajaEvento.create({
        data: {
          turnoId,
          tipo: "Cierre",
          detalle: JSON.stringify({
            resumen,
            efectivoContado: contado,
            diferencia,
            justificacion: razon || null,
          }),
          monto: diferencia,
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      return mapTurno(actualizado, resumen);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
