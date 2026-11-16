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
import { actorFromSession, auditLog, type AuditContext } from "@/lib/audit";
import { CHARGEABLE_ORDER_STATUSES } from "@/lib/order-status";

type PagoConPedido = {
  id: number;
  pedidoId: number;
  turnoId: number | null;
  cajeroNombre: string | null;
  metodo: string;
  monto: Prisma.Decimal;
  propina: Prisma.Decimal;
  referencia: string | null;
  codigoAutorizacion: string | null;
  terminal: string | null;
  montoRecibido: Prisma.Decimal | null;
  cambio: Prisma.Decimal | null;
  etiqueta: string | null;
  estado: string;
  createdAt: Date;
  pedido: {
    id: number;
    nombreMesero: string | null;
    mesa: { numero: string };
  };
  aplicaciones: Array<{
    pedidoDetalleId: number;
    cantidad: number;
    monto: Prisma.Decimal;
    pedidoDetalle: {
      producto: { nombre: string };
    };
  }>;
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
  const totalPropinas = cerrado
    ? toNumber(turno.totalPropinas)
    : (resumenCalculado?.totalPropinas ?? toNumber(turno.totalPropinas));
  const totalDevoluciones = cerrado
    ? toNumber(turno.totalDevoluciones)
    : (resumenCalculado?.totalDevoluciones ?? toNumber(turno.totalDevoluciones));
  const totalCobrado = cerrado
    ? toNumber(turno.totalCobrado)
    : (resumenCalculado?.totalCobrado ?? toNumber(turno.totalCobrado));

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
    totalPropinas,
    totalDescuentos: toNumber(turno.totalDescuentos),
    totalDevoluciones,
    totalCobrado,
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
    turnoId: pago.turnoId,
    metodo: pago.metodo,
    monto: toNumber(pago.monto),
    propina: toNumber(pago.propina),
    referencia: pago.referencia,
    codigoAutorizacion: pago.codigoAutorizacion,
    terminal: pago.terminal,
    montoRecibido: nullableNumber(pago.montoRecibido),
    cambio: nullableNumber(pago.cambio),
    etiqueta: pago.etiqueta,
    estado: pago.estado,
    createdAt: pago.createdAt.toISOString(),
    aplicaciones: pago.aplicaciones.map((aplicacion) => ({
      pedidoDetalleId: aplicacion.pedidoDetalleId,
      cantidad: aplicacion.cantidad,
      monto: toNumber(aplicacion.monto),
      productoNombre: aplicacion.pedidoDetalle.producto.nombre,
    })),
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
      aplicaciones: {
        include: {
          pedidoDetalle: {
            select: { producto: { select: { nombre: true } } },
          },
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

async function getDevoluciones(turnoId: number) {
  return prisma.devolucion.findMany({
    where: { turnoId, estado: { not: "Anulada" } },
    include: {
      detalles: {
        include: { producto: { select: { nombre: true } } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

function mapDevolucion(devolucion: Awaited<ReturnType<typeof getDevoluciones>>[number]) {
  return {
    id: devolucion.id,
    pagoId: devolucion.pagoId,
    turnoId: devolucion.turnoId,
    metodo: devolucion.metodo,
    monto: toNumber(devolucion.monto),
    propina: toNumber(devolucion.propina),
    motivo: devolucion.motivo,
    autorizadoPorNombre: devolucion.autorizadoPorNombre,
    cajeroNombre: devolucion.cajeroNombre,
    estado: devolucion.estado,
    reversionStock: devolucion.reversionStock,
    createdAt: devolucion.createdAt.toISOString(),
    detalles: devolucion.detalles.map((detalle) => ({
      productoId: detalle.productoId,
      productoNombre: detalle.producto.nombre,
      cantidad: detalle.cantidad,
      monto: nullableNumber(detalle.monto),
    })),
  };
}

export async function getTurnoResumen(turnoId: number): Promise<TurnoCajaResumenDto | null> {
  const turno = await prisma.turnoCaja.findUnique({ where: { id: turnoId } });
  if (!turno) return null;

  const [pagos, movimientos, devoluciones] = await Promise.all([
    getPagos(turnoId),
    getMovimientos(turnoId),
    getDevoluciones(turnoId),
  ]);

  const resumen = calcularTotalesCaja(
    pagos.map((pago) => ({
      metodo: pago.metodo,
      monto: toNumber(pago.monto),
      propina: toNumber(pago.propina),
    })),
    movimientos.map((movimiento) => ({
      tipo: movimiento.tipo,
      monto: toNumber(movimiento.monto),
    })),
    toNumber(turno.fondoInicial),
    devoluciones.map((devolucion) => ({
      metodo: devolucion.metodo,
      monto: toNumber(devolucion.monto),
      propina: toNumber(devolucion.propina),
    }))
  );

  const pendientesConciliar =
    turno.estado === "Abierto"
      ? pagos.filter((pago) => pago.estado === "Registrado" && pago.metodo !== "Efectivo").length
      : 0;
  const pendientesDevoluciones =
    turno.estado === "Abierto"
      ? devoluciones.filter(
          (devolucion) =>
            devolucion.estado === "Registrada" && devolucion.metodo !== "Efectivo"
        ).length
      : 0;

  return {
    turno: mapTurno(turno, resumen),
    resumen,
    pagos: pagos.map(mapPago),
    movimientos: movimientos.map(mapMovimiento),
    devoluciones: devoluciones.map(mapDevolucion),
    pendientesConciliar,
    pendientesDevoluciones,
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
    where: { estado: { in: [...CHARGEABLE_ORDER_STATUSES] } },
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
        pedido.detalles.every((detalle) =>
          ["LISTO", "SERVIDO"].includes(detalle.estado)
        )
    )
    .map((pedido) => ({
      id: pedido.id,
      mesaNumero: pedido.mesa.numero,
      meseroNombre: pedido.nombreMesero,
      total: toNumber(pedido.total),
      totalPagado: toNumber(pedido.totalPagado),
      saldo: toNumber(pedido.saldo),
      estadoPago: pedido.estadoPago,
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
  fondoInicial: number,
  audit?: AuditContext
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

      if (audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "caja.open",
            entidad: "TurnoCaja",
            entidadId: turno.id,
            despues: { turnoId: turno.id, fondoInicial: fondo, estado: turno.estado },
            motivo: "Apertura de caja",
            turnoId: turno.id,
          },
          audit,
          tx
        );
      }

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
  motivo: unknown,
  audit?: AuditContext
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

      if (audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "caja.movement",
            entidad: "MovimientoCaja",
            entidadId: movimiento.id,
            despues: {
              movimientoId: movimiento.id,
              turnoId,
              tipo,
              monto: importe,
              motivo: razon,
            },
            motivo: razon,
            turnoId,
          },
          audit,
          tx
        );
      }

      return mapMovimiento(movimiento);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function conciliarPagos(
  actor: SessionPayload,
  turnoId: number,
  pagoIds: unknown,
  devolucionIds?: unknown,
  audit?: AuditContext
): Promise<{ conciliados: number; devolucionesConciliadas: number }> {
  const ids = Array.from(
    new Set(
      (Array.isArray(pagoIds) ? pagoIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
  const devIds = Array.from(
    new Set(
      (Array.isArray(devolucionIds) ? devolucionIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  if (ids.length === 0 && devIds.length === 0) {
    throw new CajaError(
      400,
      "PAGOS_INVALIDOS",
      "Selecciona al menos un pago o devolución para conciliar."
    );
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

      let conciliados = 0;

      if (ids.length > 0) {
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
        conciliados = resultado.count;
      }

      let devolucionesConciliadas = 0;

      if (devIds.length > 0) {
        const devoluciones = await tx.devolucion.findMany({
          where: { id: { in: devIds }, turnoId },
          select: { id: true, estado: true },
        });

        if (devoluciones.length !== devIds.length) {
          throw new CajaError(
            404,
            "DEVOLUCIONES_NO_ENCONTRADAS",
            "Una o más devoluciones no pertenecen al turno indicado."
          );
        }

        if (devoluciones.some((devolucion) => devolucion.estado === "Anulada")) {
          throw new CajaError(
            400,
            "DEVOLUCION_ANULADA",
            "No se pueden conciliar devoluciones anuladas."
          );
        }

        const resultado = await tx.devolucion.updateMany({
          where: { id: { in: devIds }, turnoId, estado: "Registrada" },
          data: {
            estado: "Conciliada",
            conciliadoEn: new Date(),
            conciliadoPorId: actor.sub,
          },
        });
        devolucionesConciliadas = resultado.count;
      }

      await tx.cajaEvento.create({
        data: {
          turnoId,
          tipo: "Conciliacion",
          detalle: JSON.stringify({ pagoIds: ids, devolucionIds: devIds }),
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      if (audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "payment.conciliate",
            entidad: "TurnoCaja",
            entidadId: turnoId,
            despues: {
              turnoId,
              pagoIds: ids,
              devolucionIds: devIds,
              conciliados,
              devolucionesConciliadas,
            },
            motivo: "Conciliación de pagos",
            turnoId,
          },
          audit,
          tx
        );
      }

      return { conciliados, devolucionesConciliadas };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function cerrarTurno(
  actor: SessionPayload,
  turnoId: number,
  efectivoContado: unknown,
  justificacion: unknown,
  audit?: AuditContext
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

      const devoluciones = await tx.devolucion.findMany({
        where: { turnoId, estado: { not: "Anulada" } },
      });
      const pendientesDevoluciones = devoluciones.filter(
        (devolucion) =>
          devolucion.estado === "Registrada" && devolucion.metodo !== "Efectivo"
      );

      if (pendientesDevoluciones.length > 0) {
        throw new CajaError(
          409,
          "DEVOLUCIONES_PENDIENTES",
          `Hay ${pendientesDevoluciones.length} devolución(es) electrónica(s) pendiente(s) de conciliar.`,
          {
            pendientes: pendientesDevoluciones.map((devolucion) => ({
              id: devolucion.id,
              metodo: devolucion.metodo,
              monto: Number(devolucion.monto) + Number(devolucion.propina),
            })),
          }
        );
      }

      const movimientos = await tx.movimientoCaja.findMany({ where: { turnoId } });
      const pedidoIds = Array.from(new Set(pagos.map((pago) => pago.pedidoId)));
      const descuentos = pedidoIds.length
        ? await tx.descuento.findMany({
            where: { pedidoId: { in: pedidoIds } },
            select: { montoAplicado: true },
          })
        : [];
      const totalDescuentos = roundMoney(
        descuentos.reduce((total, descuento) => total + Number(descuento.montoAplicado), 0)
      );

      const resumen = calcularTotalesCaja(
        pagos.map((pago) => ({
          metodo: pago.metodo,
          monto: Number(pago.monto),
          propina: Number(pago.propina),
        })),
        movimientos.map((movimiento) => ({
          tipo: movimiento.tipo,
          monto: Number(movimiento.monto),
        })),
        Number(turno.fondoInicial),
        devoluciones.map((devolucion) => ({
          metodo: devolucion.metodo,
          monto: Number(devolucion.monto),
          propina: Number(devolucion.propina),
        }))
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

      await tx.devolucion.updateMany({
        where: { turnoId, estado: "Registrada", metodo: "Efectivo" },
        data: {
          estado: "Conciliada",
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
          totalPropinas: resumen.totalPropinas,
          totalDescuentos,
          totalDevoluciones: resumen.totalDevoluciones,
          totalCobrado: resumen.totalCobrado,
          totalIngresos: resumen.totalIngresos,
          totalRetiros: resumen.totalRetiros,
          totalGastos: resumen.totalGastos,
          efectivoEsperado: resumen.efectivoEsperado,
          efectivoContado: contado,
          diferencia,
          justificacion: razon || null,
        },
      });

      const pedidosPagados = pedidoIds.length
        ? await tx.pedido.findMany({
            where: {
              id: { in: pedidoIds },
              estado: "PAGADO",
              estadoPago: "Pagado",
            },
            select: { id: true },
          })
        : [];

      if (pedidosPagados.length > 0) {
        await tx.pedido.updateMany({
          where: { id: { in: pedidosPagados.map((pedido) => pedido.id) } },
          data: { estado: "CERRADO", cerradoEn },
        });
      }

      await tx.cajaEvento.create({
        data: {
          turnoId,
          tipo: "Cierre",
          detalle: JSON.stringify({
            resumen,
            totalDescuentos,
            devoluciones: devoluciones.map((devolucion) => ({
              id: devolucion.id,
              monto: Number(devolucion.monto),
              propina: Number(devolucion.propina),
              metodo: devolucion.metodo,
            })),
            efectivoContado: contado,
            diferencia,
            justificacion: razon || null,
          }),
          monto: diferencia,
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      if (audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "caja.close",
            entidad: "TurnoCaja",
            entidadId: turnoId,
            antes: {
              estado: turno.estado,
              fondoInicial: Number(turno.fondoInicial),
            },
            despues: {
              turnoId,
              estado: "Cerrado",
              efectivoContado: contado,
              efectivoEsperado: resumen.efectivoEsperado,
              diferencia,
              totalVentas: resumen.totalVentas,
              totalPropinas: resumen.totalPropinas,
              totalDescuentos,
              totalDevoluciones: resumen.totalDevoluciones,
              justificacion: razon || null,
            },
            motivo: razon || "Cierre de caja",
            turnoId,
          },
          audit,
          tx
        );
      }

      if (audit && pedidosPagados.length > 0) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "order.close",
            entidad: "Pedido",
            entidadId: pedidosPagados.map((pedido) => pedido.id).join(","),
            despues: {
              pedidoIds: pedidosPagados.map((pedido) => pedido.id),
              estado: "CERRADO",
              turnoId,
            },
            motivo: "Cierre automático al cerrar caja",
            turnoId,
          },
          audit,
          tx
        );
      }

      return mapTurno(actualizado, resumen);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
