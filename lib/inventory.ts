import { Prisma, type InsumoMovimiento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";
import { actorFromSession, auditLog, type AuditContext } from "@/lib/audit";
import { withSerializableRetry } from "@/lib/concurrency";

export type TipoMovimientoInsumo =
  | "COMPRA"
  | "CONSUMO"
  | "MERMA"
  | "AJUSTE"
  | "TRANSFERENCIA"
  | "CONTEO";

export class InventoryError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "InventoryError";
    this.status = status;
    this.code = code;
  }
}

export interface MovimientoInsumoInput {
  actor: SessionPayload;
  insumoId: number;
  almacenId: number;
  almacenDestinoId?: number | null;
  tipo: TipoMovimientoInsumo;
  cantidad: number;
  costoUnitario?: number;
  motivo?: string | null;
  referenciaTipo?: string | null;
  referenciaId?: number | null;
  pedidoId?: number | null;
  pedidoDetalleId?: number | null;
  audit?: AuditContext;
}

function finiteNumber(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new InventoryError(400, "CANTIDAD_INVALIDA", `${name} no es válido.`);
  }
  return number;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function getStock(
  tx: Prisma.TransactionClient,
  insumoId: number,
  almacenId: number
): Promise<number> {
  const stock = await tx.insumoStock.findUnique({
    where: { insumoId_almacenId: { insumoId, almacenId } },
  });
  return Number(stock?.cantidad ?? 0);
}

async function addStock(
  tx: Prisma.TransactionClient,
  insumoId: number,
  almacenId: number,
  cantidad: number
) {
  await tx.insumoStock.upsert({
    where: { insumoId_almacenId: { insumoId, almacenId } },
    update: { cantidad: { increment: cantidad } },
    create: { insumoId, almacenId, cantidad },
  });
}

async function removeStock(
  tx: Prisma.TransactionClient,
  insumoId: number,
  almacenId: number,
  cantidad: number
) {
  const actualizado = await tx.insumoStock.updateMany({
    where: {
      insumoId,
      almacenId,
      cantidad: { gte: cantidad },
    },
    data: { cantidad: { decrement: cantidad } },
  });

  if (actualizado.count === 0) {
    const stock = await getStock(tx, insumoId, almacenId);
    throw new InventoryError(
      409,
      "STOCK_INSUFICIENTE",
      `No hay stock suficiente. Disponible: ${stock.toFixed(3)}.`
    );
  }
}

export async function registrarMovimientoInsumo(
  input: MovimientoInsumoInput
): Promise<InsumoMovimiento> {
  const cantidad = finiteNumber(input.cantidad, "La cantidad");
  const motivo = String(input.motivo ?? "").trim().slice(0, 300);
  const costoUnitario = finiteNumber(input.costoUnitario ?? 0, "El costo unitario");

  if (costoUnitario < 0) {
    throw new InventoryError(400, "COSTO_INVALIDO", "El costo no puede ser negativo.");
  }
  if (input.tipo === "TRANSFERENCIA" && !input.almacenDestinoId) {
    throw new InventoryError(400, "ALMACEN_DESTINO_REQUERIDO", "Selecciona el almacén destino.");
  }
  if (
    input.tipo === "TRANSFERENCIA" &&
    input.almacenDestinoId === input.almacenId
  ) {
    throw new InventoryError(400, "ALMACEN_INVALIDO", "El origen y destino deben ser distintos.");
  }
  if (
    ["COMPRA", "CONSUMO", "MERMA", "TRANSFERENCIA"].includes(input.tipo) &&
    cantidad <= 0
  ) {
    throw new InventoryError(400, "CANTIDAD_INVALIDA", "La cantidad debe ser mayor a cero.");
  }
  if (input.tipo === "AJUSTE" && cantidad === 0) {
    throw new InventoryError(400, "CANTIDAD_INVALIDA", "El ajuste no puede ser cero.");
  }
  if (["MERMA", "AJUSTE", "CONTEO"].includes(input.tipo) && motivo.length < 3) {
    throw new InventoryError(400, "MOTIVO_REQUERIDO", "Indica el motivo del movimiento.");
  }

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const insumo = await tx.insumo.findUnique({
          where: { id: input.insumoId },
        });
        if (!insumo || !insumo.activo) {
          throw new InventoryError(404, "INSUMO_NO_ENCONTRADO", "El insumo no existe o está inactivo.");
        }

        const almacen = await tx.almacen.findUnique({
          where: { id: input.almacenId },
        });
        if (!almacen || !almacen.activo) {
          throw new InventoryError(404, "ALMACEN_NO_ENCONTRADO", "El almacén no existe.");
        }

        const stockAntes = await getStock(tx, input.insumoId, input.almacenId);
        const costoPromedioAntes = Number(insumo.costoPromedio);
        let costoPromedio = costoPromedioAntes;
        let cantidadMovimiento = cantidad;
        let costoMovimiento = costoUnitario;

        if (input.tipo === "TRANSFERENCIA") {
          if (!input.almacenDestinoId) {
            throw new InventoryError(400, "ALMACEN_DESTINO_REQUERIDO", "Selecciona el almacén destino.");
          }
          const destino = await tx.almacen.findUnique({
            where: { id: input.almacenDestinoId },
          });
          if (!destino || !destino.activo) {
            throw new InventoryError(404, "ALMACEN_NO_ENCONTRADO", "El almacén destino no existe.");
          }
          await removeStock(tx, input.insumoId, input.almacenId, cantidad);
          await addStock(tx, input.insumoId, input.almacenDestinoId, cantidad);
          cantidadMovimiento = cantidad;
          costoMovimiento = 0;
        } else if (input.tipo === "COMPRA") {
          const stockDestino = await getStock(tx, input.insumoId, input.almacenId);
          const nuevoCosto =
            stockDestino > 0
              ? round4(
                  (stockDestino * costoPromedio + cantidad * costoUnitario) /
                    (stockDestino + cantidad)
                )
              : round4(costoUnitario);
          await addStock(tx, input.insumoId, input.almacenId, cantidad);
          await tx.insumo.update({
            where: { id: input.insumoId },
            data: { costoPromedio: nuevoCosto },
          });
          costoPromedio = nuevoCosto;
          cantidadMovimiento = cantidad;
          costoMovimiento = costoUnitario;
        } else if (input.tipo === "CONSUMO" || input.tipo === "MERMA") {
          await removeStock(tx, input.insumoId, input.almacenId, cantidad);
          cantidadMovimiento = -cantidad;
          costoMovimiento = costoPromedio;
        } else {
          const ajuste = input.tipo === "CONTEO" ? cantidad : cantidad;
          if (ajuste > 0) {
            await addStock(tx, input.insumoId, input.almacenId, ajuste);
          } else if (ajuste < 0) {
            await removeStock(tx, input.insumoId, input.almacenId, Math.abs(ajuste));
          }
          cantidadMovimiento = ajuste;
          costoMovimiento = costoPromedio;
        }

        const stockDespues = await getStock(tx, input.insumoId, input.almacenId);
        const costoTotal = round4(Math.abs(cantidadMovimiento) * costoMovimiento);

        const movimiento = await tx.insumoMovimiento.create({
          data: {
            insumoId: input.insumoId,
            almacenId: input.almacenId,
            almacenDestinoId: input.almacenDestinoId ?? null,
            tipo: input.tipo,
            cantidad: cantidadMovimiento,
            costoUnitario: round4(costoMovimiento),
            costoTotal,
            motivo: motivo || null,
            responsableId: input.actor.sub,
            responsableNombre: input.actor.nombre,
            referenciaTipo: input.referenciaTipo ?? null,
            referenciaId: input.referenciaId ?? null,
            pedidoId: input.pedidoId ?? null,
            pedidoDetalleId: input.pedidoDetalleId ?? null,
          },
        });

        if (input.audit) {
          await auditLog(
            {
              actor: actorFromSession(input.actor),
              accion: "inventory.movement",
              entidad: "Insumo",
              entidadId: insumo.id,
              antes: { stock: stockAntes, costoPromedio: costoPromedioAntes },
              despues: {
                movimientoId: movimiento.id,
                tipo: input.tipo,
                cantidad: cantidadMovimiento,
                stock: stockDespues,
                costoUnitario: costoMovimiento,
                costoTotal,
              },
              motivo: motivo || `Movimiento de inventario: ${input.tipo}`,
            },
            input.audit,
            tx
          );
        }

        return movimiento;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}

async function consumirEnTx(
  tx: Prisma.TransactionClient,
  input: {
    actor: SessionPayload;
    insumoId: number;
    almacenId: number;
    cantidad: number;
    pedidoId: number;
    pedidoDetalleId: number;
  }
): Promise<number> {
  const insumo = await tx.insumo.findUnique({ where: { id: input.insumoId } });
  if (!insumo || !insumo.activo) {
    throw new InventoryError(404, "INSUMO_NO_ENCONTRADO", "Uno de los insumos de la receta no existe.");
  }

  const costoUnitario = Number(insumo.costoPromedio);
  await removeStock(tx, input.insumoId, input.almacenId, input.cantidad);
  const costoTotal = round4(input.cantidad * costoUnitario);

  await tx.insumoMovimiento.create({
    data: {
      insumoId: input.insumoId,
      almacenId: input.almacenId,
      tipo: "CONSUMO",
      cantidad: -input.cantidad,
      costoUnitario,
      costoTotal,
      motivo: "Consumo por venta",
      responsableId: input.actor.sub,
      responsableNombre: input.actor.nombre,
      referenciaTipo: "Pedido",
      referenciaId: input.pedidoId,
      pedidoId: input.pedidoId,
      pedidoDetalleId: input.pedidoDetalleId,
    },
  });

  return costoTotal;
}

export async function consumirInventarioPedido(
  tx: Prisma.TransactionClient,
  pedidoId: number,
  actor: SessionPayload,
  auditContext?: AuditContext
): Promise<void> {
  const claimed = await tx.pedido.updateMany({
    where: { id: pedidoId, inventarioConsumido: false },
    data: { inventarioConsumido: true, inventarioConsumidoEn: new Date() },
  });
  if (claimed.count === 0) return;

  const cocina = await tx.almacen.findUnique({ where: { codigo: "COCINA" } });
  if (!cocina) {
    throw new InventoryError(500, "ALMACEN_COCINA_NO_CONFIGURADO", "No existe el almacén COCINA.");
  }

  const pedido = await tx.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      detalles: {
        include: {
          producto: {
            include: {
              receta: {
                include: {
                  detalles: { include: { insumo: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!pedido) throw new InventoryError(404, "PEDIDO_NO_ENCONTRADO", "Pedido no encontrado.");

  let costoPedido = 0;

  for (const detalle of pedido.detalles) {
    if (detalle.producto.tipoInventario !== "RECETA") continue;

    const receta = detalle.producto.receta;
    if (!receta || !receta.activo || receta.detalles.length === 0) {
      throw new InventoryError(
        409,
        "RECETA_FALTANTE",
        `El producto "${detalle.producto.nombre}" está marcado como receta, pero no tiene receta activa.`
      );
    }

    const rendimiento = Number(receta.rendimiento);
    if (!Number.isFinite(rendimiento) || rendimiento <= 0) {
      throw new InventoryError(409, "RECETA_INVALIDA", "La receta tiene un rendimiento inválido.");
    }

    const merma = Number(receta.mermaPorcentaje);
    let costoLinea = 0;

    for (const ingrediente of receta.detalles) {
      const cantidadBase = round3(
        (Number(ingrediente.cantidad) * (1 + merma / 100) * detalle.cantidad) /
          rendimiento
      );
      if (cantidadBase <= 0) continue;

      costoLinea += await consumirEnTx(tx, {
        actor,
        insumoId: ingrediente.insumoId,
        almacenId: cocina.id,
        cantidad: cantidadBase,
        pedidoId,
        pedidoDetalleId: detalle.id,
      });
    }

    const costoUnitario = round4(costoLinea / detalle.cantidad);
    await tx.pedidoDetalle.update({
      where: { id: detalle.id },
      data: {
        costoUnitario,
        costoTotal: round4(costoLinea),
      },
    });
    costoPedido += costoLinea;
  }

  if (auditContext) {
    await auditLog(
      {
        actor: actorFromSession(actor),
        accion: "inventory.consume",
        entidad: "Pedido",
        entidadId: pedidoId,
        despues: {
          pedidoId,
          costoTotal: round4(costoPedido),
          almacenId: cocina.id,
        },
        motivo: "Consumo de insumos al iniciar cocina",
      },
      auditContext,
      tx
    );
  }
}
