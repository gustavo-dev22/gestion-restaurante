import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CajaError } from "@/lib/caja-errors";
import {
  calcularDescuento,
  esMetodoPago,
  esTipoDescuento,
  roundMoney,
  type CuentaPedidoDto,
  type DevolucionDto,
  type PagoCajaDto,
} from "@/lib/caja-types";
import type { SessionPayload } from "@/lib/auth/session";
import { actorFromSession, auditLog, type AuditContext } from "@/lib/audit";

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

type CuentaPedidoQuery = Prisma.PedidoGetPayload<{
  include: {
    mesa: { select: { numero: true } };
    detalles: {
      include: {
        producto: { select: { id: true; nombre: true; precio: true; stock: true } };
      };
    };
    pagos: {
      include: {
        aplicaciones: {
          include: {
            pedidoDetalle: {
              select: { producto: { select: { nombre: true } } };
            };
          };
        };
      };
    };
    descuento: true;
    devoluciones: {
      include: {
        detalles: {
          include: { producto: { select: { nombre: true } } };
        };
      };
    };
    comprobante: true;
  };
}>;

function mapPagoCuenta(
  pago: CuentaPedidoQuery["pagos"][number],
  mesaNumero: string,
  meseroNombre: string | null
): PagoCajaDto {
  return {
    id: pago.id,
    pedidoId: pago.pedidoId,
    mesaNumero,
    meseroNombre,
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

function mapDevolucionCuenta(
  devolucion: CuentaPedidoQuery["devoluciones"][number]
): DevolucionDto {
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

function mapCuenta(pedido: CuentaPedidoQuery): CuentaPedidoDto {
  const aplicacionesPorDetalle = new Map<number, number>();

  for (const pago of pedido.pagos) {
    if (pago.estado === "Anulado") continue;
    for (const aplicacion of pago.aplicaciones) {
      aplicacionesPorDetalle.set(
        aplicacion.pedidoDetalleId,
        (aplicacionesPorDetalle.get(aplicacion.pedidoDetalleId) ?? 0) +
          aplicacion.cantidad
      );
    }
  }

  const detalles = pedido.detalles.map((detalle) => {
    const cantidadPagada = aplicacionesPorDetalle.get(detalle.id) ?? 0;
    const precioUnitario = Number(detalle.precio_unitario || detalle.producto.precio);
    return {
      id: detalle.id,
      productoId: detalle.productoId,
      nombre: detalle.producto.nombre,
      cantidad: detalle.cantidad,
      precioUnitario,
      cantidadPagada,
      cantidadPendiente: Math.max(0, detalle.cantidad - cantidadPagada),
      subtotal: roundMoney(precioUnitario * detalle.cantidad),
      estado: detalle.estado,
    };
  });

  const descuento = pedido.descuento
    ? {
        tipo: pedido.descuento.tipo,
        valor: toNumber(pedido.descuento.valor),
        montoAplicado: toNumber(pedido.descuento.montoAplicado),
        motivo: pedido.descuento.motivo,
        autorizadoPorNombre: pedido.descuento.autorizadoPorNombre,
        createdAt: pedido.descuento.createdAt.toISOString(),
      }
    : null;

  return {
    pedido: {
      id: pedido.id,
      mesaNumero: pedido.mesa.numero,
      meseroNombre: pedido.nombreMesero,
      estado: pedido.estado,
      estadoPago: pedido.estadoPago,
      subtotal: toNumber(pedido.subtotal),
      descuentoTotal: toNumber(pedido.descuentoTotal),
      propinaTotal: toNumber(pedido.propinaTotal),
      total: toNumber(pedido.total),
      totalPagado: toNumber(pedido.totalPagado),
      saldo: toNumber(pedido.saldo),
      createdAt: (pedido.fecha_creacion ?? new Date()).toISOString(),
      pagadoEn: pedido.pagadoEn?.toISOString() ?? null,
    },
    detalles,
    pagos: pedido.pagos.map((pago) =>
      mapPagoCuenta(pago, pedido.mesa.numero, pedido.nombreMesero)
    ),
    descuento,
    devoluciones: pedido.devoluciones.map(mapDevolucionCuenta),
    comprobante: pedido.comprobante
      ? {
          id: pedido.comprobante.id,
          tipo: pedido.comprobante.tipo,
          monto: toNumber(pedido.comprobante.monto),
          estado: pedido.comprobante.estado,
          createdAt: pedido.comprobante.createdAt.toISOString(),
        }
      : null,
    esCuentaActual: pedido.estado === "Pendiente",
  };
}

export async function getCuentaPedido(pedidoId: number): Promise<CuentaPedidoDto | null> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      mesa: { select: { numero: true } },
      detalles: {
        include: {
          producto: { select: { id: true, nombre: true, precio: true, stock: true } },
        },
        orderBy: { id: "asc" },
      },
      pagos: {
        include: {
          aplicaciones: {
            include: {
              pedidoDetalle: {
                select: { producto: { select: { nombre: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      descuento: true,
      devoluciones: {
        include: {
          detalles: {
            include: { producto: { select: { nombre: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      comprobante: true,
    },
  });

  return pedido ? mapCuenta(pedido) : null;
}

export interface AplicarDescuentoInput {
  tipo?: unknown;
  valor?: unknown;
  motivo?: unknown;
  cuponCodigo?: unknown;
}

export async function aplicarDescuento(
  actor: SessionPayload,
  pedidoId: number,
  input: AplicarDescuentoInput,
  audit?: AuditContext
): Promise<void> {
  const motivo = String(input.motivo ?? "").trim().slice(0, 300);
  if (motivo.length < 3) {
    throw new CajaError(400, "MOTIVO_INVALIDO", "Describe el motivo del descuento.");
  }

  const codigo = String(input.cuponCodigo ?? "").trim().toUpperCase();

  await prisma.$transaction(
    async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          detalles: { include: { producto: true } },
          pagos: { where: { estado: { not: "Anulado" } }, select: { id: true } },
          descuento: { select: { id: true } },
        },
      });

      if (!pedido) throw new CajaError(404, "PEDIDO_NO_ENCONTRADO", "Pedido no encontrado.");
      if (pedido.pagos.length > 0) {
        throw new CajaError(
          409,
          "DESCUENTO_CON_PAGOS",
          "El descuento debe aplicarse antes de registrar pagos."
        );
      }
      if (pedido.descuento) {
        throw new CajaError(409, "DESCUENTO_EXISTENTE", "El pedido ya tiene un descuento.");
      }

      const pedidoAntes = {
        subtotal: Number(pedido.subtotal),
        descuentoTotal: Number(pedido.descuentoTotal),
        total: Number(pedido.total),
        saldo: Number(pedido.saldo),
        estadoPago: pedido.estadoPago,
      };

      const subtotal = roundMoney(
        pedido.detalles.reduce(
          (total, detalle) =>
            total + Number(detalle.producto.precio) * detalle.cantidad,
          0
        )
      );

      let tipo = input.tipo;
      let valor = Number(input.valor);
      let cuponId: number | null = null;

      if (codigo) {
        const cupon = await tx.cupon.findUnique({ where: { codigo } });
        const ahora = new Date();
        if (!cupon || !cupon.activo) {
          throw new CajaError(400, "CUPON_INVALIDO", "El cupón no existe o está inactivo.");
        }
        if (cupon.validoDesde && cupon.validoDesde > ahora) {
          throw new CajaError(400, "CUPON_INVALIDO", "El cupón aún no está vigente.");
        }
        if (cupon.validoHasta && cupon.validoHasta < ahora) {
          throw new CajaError(400, "CUPON_VENCIDO", "El cupón está vencido.");
        }
        if (cupon.usosMaximos !== null && cupon.usos >= cupon.usosMaximos) {
          throw new CajaError(409, "CUPON_AGOTADO", "El cupón ya no tiene usos disponibles.");
        }

        const actualizado = await tx.cupon.updateMany({
          where: {
            id: cupon.id,
            activo: true,
            ...(cupon.usosMaximos !== null
              ? { usos: { lt: cupon.usosMaximos } }
              : {}),
          },
          data: { usos: { increment: 1 } },
        });
        if (actualizado.count === 0) {
          throw new CajaError(409, "CUPON_AGOTADO", "El cupón ya no tiene usos disponibles.");
        }

        tipo = cupon.tipo;
        valor = Number(cupon.valor);
        cuponId = cupon.id;
      }

      if (!esTipoDescuento(tipo)) {
        throw new CajaError(400, "TIPO_DESCUENTO_INVALIDO", "Tipo de descuento inválido.");
      }
      const monto = calcularDescuento(tipo, valor, subtotal);
      if (monto <= 0) {
        throw new CajaError(400, "DESCUENTO_INVALIDO", "El descuento debe ser mayor a cero.");
      }
      if (monto >= subtotal) {
        throw new CajaError(400, "DESCUENTO_EXCESIVO", "El descuento no puede cubrir todo el pedido.");
      }

      let descuentoId: number;
      try {
        const descuento = await tx.descuento.create({
          data: {
            pedidoId,
            tipo,
            valor,
            montoAplicado: monto,
            motivo,
            cuponId,
            autorizadoPorId: actor.sub,
            autorizadoPorNombre: actor.nombre,
          },
        });
        descuentoId = descuento.id;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new CajaError(409, "DESCUENTO_EXISTENTE", "El pedido ya tiene un descuento.");
        }
        throw error;
      }

      const propinaTotal = Number(pedido.propinaTotal);
      const total = roundMoney(subtotal - monto + propinaTotal);
      const totalPagado = Number(pedido.totalPagado);
      const saldo = roundMoney(total - totalPagado);

      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          subtotal,
          descuentoTotal: monto,
          total,
          saldo,
          estadoPago: saldo <= 0 ? "Pagado" : totalPagado > 0 ? "Parcial" : "Pendiente",
        },
      });

      if (audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "discount.apply",
            entidad: "Descuento",
            entidadId: descuentoId,
            antes: pedidoAntes,
            despues: {
              descuentoId,
              pedidoId,
              tipo,
              valor,
              montoAplicado: monto,
              cuponId,
              subtotal,
              total,
              saldo,
              estadoPago: saldo <= 0 ? "Pagado" : totalPagado > 0 ? "Parcial" : "Pendiente",
            },
            motivo,
          },
          audit,
          tx
        );
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export interface DevolucionItemInput {
  pedidoDetalleId: number;
  cantidad: number;
}

export interface RegistrarDevolucionInput {
  pagoId?: unknown;
  monto?: unknown;
  propina?: unknown;
  motivo?: unknown;
  items?: unknown;
  audit?: AuditContext;
}

export async function registrarDevolucion(
  actor: SessionPayload,
  pedidoId: number,
  input: RegistrarDevolucionInput
): Promise<void> {
  const pagoId = Number(input.pagoId);
  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    throw new CajaError(400, "PAGO_INVALIDO", "Selecciona el pago a devolver.");
  }

  const motivo = String(input.motivo ?? "").trim().slice(0, 500);
  if (motivo.length < 3) {
    throw new CajaError(400, "MOTIVO_INVALIDO", "Describe el motivo de la devolución.");
  }

  const itemsInput = Array.isArray(input.items) ? input.items : [];

  await prisma.$transaction(
    async (tx) => {
      const turno = await tx.turnoCaja.findFirst({
        where: { estado: "Abierto" },
        orderBy: { abiertoEn: "desc" },
        select: { id: true },
      });
      if (!turno) {
        throw new CajaError(409, "CAJA_CERRADA", "Abre una caja para registrar la devolución.");
      }

      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          detalles: { include: { producto: true } },
        },
      });
      if (!pedido) throw new CajaError(404, "PEDIDO_NO_ENCONTRADO", "Pedido no encontrado.");
      if (pedido.estadoPago !== "Pagado" && pedido.estadoPago !== "Reembolsado") {
        throw new CajaError(
          409,
          "PEDIDO_NO_PAGADO",
          "Solo se puede devolver un pedido pagado. Para un pago parcial usa anulación."
        );
      }

      const pago = await tx.pago.findFirst({
        where: { id: pagoId, pedidoId },
      });
      if (!pago) {
        throw new CajaError(404, "PAGO_NO_ENCONTRADO", "Pago no encontrado para el pedido.");
      }
      if (pago.estado === "Anulado" || pago.estado === "Reembolsado") {
        throw new CajaError(409, "PAGO_REEMBOLSADO", "El pago ya fue anulado o reembolsado.");
      }

      const pagoAntes = {
        id: pago.id,
        pedidoId: pago.pedidoId,
        metodo: pago.metodo,
        monto: Number(pago.monto),
        propina: Number(pago.propina),
        estado: pago.estado,
      };

      const devolucionesPrevias = await tx.devolucion.findMany({
        where: { pagoId, estado: { not: "Anulada" } },
        select: { monto: true, propina: true },
      });
      const devueltoMonto = roundMoney(
        devolucionesPrevias.reduce((total, devolucion) => total + Number(devolucion.monto), 0)
      );
      const devueltoPropina = roundMoney(
        devolucionesPrevias.reduce((total, devolucion) => total + Number(devolucion.propina), 0)
      );

      const disponibleMonto = roundMoney(Number(pago.monto) - devueltoMonto);
      const disponiblePropina = roundMoney(Number(pago.propina) - devueltoPropina);
      const monto =
        input.monto === null || input.monto === undefined
          ? disponibleMonto
          : roundMoney(Number(input.monto));
      const propina =
        input.propina === null || input.propina === undefined
          ? 0
          : roundMoney(Number(input.propina));

      if (!Number.isFinite(monto) || monto < 0 || monto > disponibleMonto) {
        throw new CajaError(400, "MONTO_INVALIDO", "El monto de devolución no es válido.");
      }
      if (!Number.isFinite(propina) || propina < 0 || propina > disponiblePropina) {
        throw new CajaError(400, "PROPINA_INVALIDA", "La propina a devolver no es válida.");
      }
      if (monto <= 0 && propina <= 0) {
        throw new CajaError(400, "MONTO_INVALIDO", "La devolución debe tener un monto.");
      }

      const detallesMap = new Map(
        pedido.detalles.map((detalle) => [detalle.id, detalle])
      );
      const items: DevolucionItemInput[] = [];
      for (const item of itemsInput) {
        const record = item as Record<string, unknown>;
        const detalleId = Number(record.pedidoDetalleId);
        const cantidad = Math.floor(Number(record.cantidad));
        if (!Number.isInteger(detalleId) || detalleId <= 0 || cantidad <= 0) {
          throw new CajaError(400, "ITEM_INVALIDO", "Uno de los ítems devueltos es inválido.");
        }
        if (!detallesMap.has(detalleId)) {
          throw new CajaError(400, "DETALLE_INVALIDO", "El ítem no pertenece al pedido.");
        }
        items.push({ pedidoDetalleId: detalleId, cantidad });
      }

      if (items.length > 0) {
        const devueltos = await tx.devolucionDetalle.groupBy({
          by: ["pedidoDetalleId"],
          where: {
            devolucion: { pedidoId, estado: { not: "Anulada" } },
            pedidoDetalleId: { not: null },
          },
          _sum: { cantidad: true },
        });
        const devueltoPorDetalle = new Map(
          devueltos
            .filter((item) => item.pedidoDetalleId !== null)
            .map((item) => [
              item.pedidoDetalleId as number,
              item._sum.cantidad ?? 0,
            ])
        );

        const solicitadoPorDetalle = new Map<number, number>();
        for (const item of items) {
          const detalle = detallesMap.get(item.pedidoDetalleId)!;
          const solicitado =
            (solicitadoPorDetalle.get(item.pedidoDetalleId) ?? 0) + item.cantidad;
          const yaDevuelto = devueltoPorDetalle.get(item.pedidoDetalleId) ?? 0;
          if (solicitado + yaDevuelto > detalle.cantidad) {
            throw new CajaError(
              409,
              "CANTIDAD_EXCEDIDA",
              `La cantidad devuelta de "${detalle.producto.nombre}" supera lo vendido.`
            );
          }
          solicitadoPorDetalle.set(item.pedidoDetalleId, solicitado);
        }
      }

      const metodo = pago.metodo;
      if (!esMetodoPago(metodo)) {
        throw new CajaError(400, "METODO_INVALIDO", "El método del pago no es válido.");
      }

      const devolucion = await tx.devolucion.create({
        data: {
          pedidoId,
          pagoId,
          turnoId: turno.id,
          cajeroId: actor.sub,
          cajeroNombre: actor.nombre,
          metodo,
          monto,
          propina,
          motivo,
          autorizadoPorId: actor.sub,
          autorizadoPorNombre: actor.nombre,
          estado: metodo === "Efectivo" ? "Conciliada" : "Registrada",
          reversionStock: items.length > 0,
          ...(metodo === "Efectivo"
            ? { conciliadoEn: new Date(), conciliadoPorId: actor.sub }
            : {}),
        },
      });

      for (const item of items) {
        const detalle = detallesMap.get(item.pedidoDetalleId)!;
        await tx.devolucionDetalle.create({
          data: {
            devolucionId: devolucion.id,
            pedidoDetalleId: detalle.id,
            productoId: detalle.productoId,
            cantidad: item.cantidad,
            monto: null,
          },
        });

        if (detalle.producto.stock !== null) {
          await tx.producto.update({
            where: { id: detalle.productoId },
            data: { stock: { increment: item.cantidad } },
          });
          await tx.movimientoStock.create({
            data: {
              productoId: detalle.productoId,
              cantidad: item.cantidad,
              tipo: "Devolucion",
              motivo,
              referenciaId: devolucion.id,
              usuarioId: actor.sub,
              usuarioNombre: actor.nombre,
            },
          });
        }
      }

      const totalMontoDevuelto = roundMoney(devueltoMonto + monto);
      const totalPropinaDevuelta = roundMoney(devueltoPropina + propina);
      const pagoCompleto =
        totalMontoDevuelto >= Number(pago.monto) - 0.009 &&
        totalPropinaDevuelta >= Number(pago.propina) - 0.009;

      if (pagoCompleto) {
        await tx.pago.update({
          where: { id: pago.id },
          data: { estado: "Reembolsado" },
        });
      }

      const pagos = await tx.pago.findMany({
        where: { pedidoId, estado: { not: "Anulado" } },
        select: { estado: true },
      });
      if (pagos.length > 0 && pagos.every((item) => item.estado === "Reembolsado")) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { estadoPago: "Reembolsado" },
        });
      }

      await tx.cajaEvento.create({
        data: {
          turnoId: turno.id,
          tipo: "Devolucion",
          detalle: JSON.stringify({
            devolucionId: devolucion.id,
            pagoId,
            monto,
            propina,
            metodo,
            items,
          }),
          monto: roundMoney(monto + propina),
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      if (input.audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "payment.refund",
            entidad: "Devolucion",
            entidadId: devolucion.id,
            antes: pagoAntes,
            despues: {
              devolucionId: devolucion.id,
              pedidoId,
              pagoId,
              metodo,
              monto,
              propina,
              items,
              reversionStock: items.length > 0,
              pagoEstado: pagoCompleto ? "Reembolsado" : pago.estado,
            },
            motivo,
            turnoId: turno.id,
          },
          input.audit,
          tx
        );
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function anularPago(
  actor: SessionPayload,
  pedidoId: number,
  pagoId: number,
  motivo: unknown,
  audit?: AuditContext
): Promise<void> {
  const razon = String(motivo ?? "").trim().slice(0, 500);
  if (razon.length < 3) {
    throw new CajaError(400, "MOTIVO_INVALIDO", "Describe el motivo de la anulación.");
  }

  await prisma.$transaction(
    async (tx) => {
      const turno = await tx.turnoCaja.findFirst({
        where: { estado: "Abierto" },
        orderBy: { abiertoEn: "desc" },
        select: { id: true },
      });
      if (!turno) {
        throw new CajaError(409, "CAJA_CERRADA", "Abre una caja para anular el pago.");
      }

      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { detalles: { include: { producto: true } } },
      });
      if (!pedido) throw new CajaError(404, "PEDIDO_NO_ENCONTRADO", "Pedido no encontrado.");

      const pago = await tx.pago.findFirst({
        where: { id: pagoId, pedidoId },
      });
      if (!pago) throw new CajaError(404, "PAGO_NO_ENCONTRADO", "Pago no encontrado.");
      if (pago.turnoId !== turno.id) {
        throw new CajaError(
          409,
          "PAGO_DE_OTRO_TURNO",
          "El pago pertenece a otro turno. Usa una devolución."
        );
      }
      if (pago.estado === "Anulado" || pago.estado === "Reembolsado") {
        throw new CajaError(409, "PAGO_YA_ANULADO", "El pago ya fue anulado o reembolsado.");
      }

      const pagoAntes = {
        id: pago.id,
        pedidoId: pago.pedidoId,
        turnoId: pago.turnoId,
        metodo: pago.metodo,
        monto: Number(pago.monto),
        propina: Number(pago.propina),
        estado: pago.estado,
      };
      const pedidoAntes = {
        total: Number(pedido.total),
        totalPagado: Number(pedido.totalPagado),
        saldo: Number(pedido.saldo),
        estadoPago: pedido.estadoPago,
      };

      await tx.pago.update({
        where: { id: pago.id },
        data: {
          estado: "Anulado",
          anuladoPorId: actor.sub,
          anuladoPorNombre: actor.nombre,
          anuladoEn: new Date(),
          motivoAnulacion: razon,
        },
      });

      const subtotal = roundMoney(
        pedido.detalles.reduce(
          (total, detalle) =>
            total + Number(detalle.producto.precio) * detalle.cantidad,
          0
        )
      );
      const propinaTotal = Math.max(0, roundMoney(Number(pedido.propinaTotal) - Number(pago.propina)));
      const total = roundMoney(subtotal - Number(pedido.descuentoTotal) + propinaTotal);
      const totalPagado = Math.max(
        0,
        roundMoney(Number(pedido.totalPagado) - Number(pago.monto) - Number(pago.propina))
      );
      const saldo = Math.max(0, roundMoney(total - totalPagado));
      const pagado = saldo <= 0.009;

      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          propinaTotal,
          total,
          totalPagado,
          saldo,
          estadoPago: pagado ? "Pagado" : totalPagado > 0 ? "Parcial" : "Pendiente",
          estado: pagado ? "Pagado" : "Pendiente",
          pagadoEn: pagado ? pedido.pagadoEn : null,
        },
      });

      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: pagado ? "Libre" : "Ocupada" },
      });

      await tx.comprobante.updateMany({
        where: { pedidoId },
        data: { estado: pagado ? "Emitido" : "Anulado", monto: total },
      });

      await tx.cajaEvento.create({
        data: {
          turnoId: turno.id,
          tipo: "AnulacionPago",
          detalle: JSON.stringify({
            pagoId: pago.id,
            monto: Number(pago.monto),
            propina: Number(pago.propina),
            motivo: razon,
          }),
          monto: roundMoney(Number(pago.monto) + Number(pago.propina)),
          usuarioId: actor.sub,
          usuarioNombre: actor.nombre,
        },
      });

      if (audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "payment.void",
            entidad: "Pago",
            entidadId: pago.id,
            antes: { pago: pagoAntes, pedido: pedidoAntes },
            despues: {
              pagoId: pago.id,
              pedidoId,
              estado: "Anulado",
              total,
              totalPagado,
              saldo,
              estadoPago: pagado ? "Pagado" : totalPagado > 0 ? "Parcial" : "Pendiente",
            },
            motivo: razon,
            turnoId: turno.id,
          },
          audit,
          tx
        );
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
