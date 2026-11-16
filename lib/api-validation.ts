import { NextResponse } from "next/server";
import { z } from "zod";
import { parseLimaDateTime } from "@/lib/utils";
import {
  ACTIVE_ORDER_STATUSES,
  DETAIL_STATUS,
  ORDER_STATUS,
  type DetailStatus,
  type OrderStatus,
} from "@/lib/order-status";

export interface ValidationFailure {
  success: false;
  response: NextResponse;
}

export type ValidationResult<T> = { success: true; data: T } | ValidationFailure;

function issueKey(path: PropertyKey[]): string {
  const key = path.map((part) => String(part)).join(".");
  return key || "root";
}

export function zodErrorResponse(error: z.ZodError): NextResponse {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issueKey(issue.path);
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }

  return NextResponse.json(
    {
      error: "VALIDACION",
      message: "Datos inválidos",
      fieldErrors,
    },
    { status: 400 }
  );
}

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "JSON_INVALIDO",
          message: "El cuerpo de la solicitud no es JSON válido.",
        },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return { success: false, response: zodErrorResponse(result.error) };
  }
  return { success: true, data: result.data };
}

export function parseQuery<T>(
  params: URLSearchParams,
  schema: z.ZodType<T>
): ValidationResult<T> {
  const result = schema.safeParse(Object.fromEntries(params.entries()));
  if (!result.success) {
    return { success: false, response: zodErrorResponse(result.error) };
  }
  return { success: true, data: result.data };
}

export function parseValue<T>(
  value: unknown,
  schema: z.ZodType<T>
): ValidationResult<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { success: false, response: zodErrorResponse(result.error) };
  }
  return { success: true, data: result.data };
}

export const idSchema = z.coerce.number().int().positive();

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const rolePermissionsSchema = z.object({
  rolId: idSchema,
  permisos: z.array(z.string().min(1).max(100)),
});

export const userRolesSchema = z.object({
  usuarioId: idSchema,
  rolIds: z.array(idSchema),
});

export const salonMesaSchema = z.object({
  mesaId: idSchema,
});
export const optionalIdSchema = z.coerce.number().int().positive().optional();
export const moneySchema = z.coerce.number().finite().min(0);
export const positiveMoneySchema = z.coerce.number().finite().positive();
export const priceSchema = z.coerce.number().finite().min(0);
export const stockSchema = z.union([
  z.null(),
  z.coerce.number().int().min(0),
]);
export const motivoSchema = z.string().trim().min(3).max(500);
export const optionalTextSchema = (max: number) =>
  z.string().trim().max(max).optional().nullable();
export const pageSchema = z.coerce.number().int().positive().default(1);

export const orderStatusSchema = z.enum([
  ORDER_STATUS.BORRADOR,
  ORDER_STATUS.CONFIRMADO,
  ORDER_STATUS.EN_COCINA,
  ORDER_STATUS.PARCIALMENTE_LISTO,
  ORDER_STATUS.LISTO,
  ORDER_STATUS.SERVIDO,
  ORDER_STATUS.POR_COBRAR,
  ORDER_STATUS.PAGADO,
  ORDER_STATUS.CERRADO,
  ORDER_STATUS.ANULADO,
]);

export const detailStatusSchema = z.enum([
  DETAIL_STATUS.PENDIENTE,
  DETAIL_STATUS.EN_PREPARACION,
  DETAIL_STATUS.LISTO,
  DETAIL_STATUS.SERVIDO,
]);

export const activeOrderStatusSchema = z.enum(
  ACTIVE_ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]
);

export const detailStatusInputSchema = z.enum([
  DETAIL_STATUS.EN_PREPARACION,
  DETAIL_STATUS.LISTO,
]);

export const limaDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Boolean(parseLimaDateTime(value)), {
    message: "La fecha y hora no son válidas.",
  });

export const paymentMethodSchema = z.enum([
  "Efectivo",
  "Tarjeta",
  "Billetera",
  "Yape",
  "Plin",
  "Transferencia",
  "Otro",
]);

export const paymentSchema = z.object({
  metodoPago: paymentMethodSchema,
  monto: positiveMoneySchema.optional(),
  propina: moneySchema.optional(),
  referencia: optionalTextSchema(100),
  codigoAutorizacion: optionalTextSchema(100),
  terminal: optionalTextSchema(50),
  montoRecibido: moneySchema.optional().nullable(),
  etiqueta: optionalTextSchema(50),
  aplicaciones: z
    .array(
      z.object({
        pedidoDetalleId: idSchema,
        cantidad: z.coerce.number().int().positive(),
      })
    )
    .optional(),
});

export const pagoPedidoSchema = paymentSchema.extend({
  pedidoId: idSchema,
});

export const descuentoSchema = z.object({
  tipo: z.enum(["Porcentaje", "Monto"]).optional(),
  valor: z.coerce.number().finite().min(0).optional(),
  motivo: motivoSchema,
  cuponCodigo: z.string().trim().max(50).optional().nullable(),
});

export const devolucionSchema = z.object({
  pagoId: idSchema,
  monto: moneySchema.optional().nullable(),
  propina: moneySchema.optional().nullable(),
  motivo: motivoSchema,
  items: z
    .array(
      z.object({
        pedidoDetalleId: idSchema,
        cantidad: z.coerce.number().int().positive(),
      })
    )
    .optional(),
});

export const anulacionSchema = z.object({
  pagoId: idSchema,
  motivo: motivoSchema,
});

export const movimientoCajaSchema = z.object({
  tipo: z.enum(["Ingreso", "Retiro", "Gasto"]),
  monto: positiveMoneySchema,
  motivo: motivoSchema,
});

export const cerrarCajaSchema = z.object({
  efectivoContado: moneySchema,
  justificacion: z.string().trim().max(500).optional().nullable(),
});

export const conciliarSchema = z.object({
  pagoIds: z.array(idSchema).optional(),
  devolucionIds: z.array(idSchema).optional(),
});

export const abrirCajaSchema = z.object({
  fondoInicial: moneySchema,
});

export const productoSchema = z.object({
  nombre: z.string().trim().min(1).max(150),
  descripcion: optionalTextSchema(1000),
  precio: priceSchema,
  stock: stockSchema.optional(),
  categoriaId: idSchema,
  imagen_url: z.string().trim().max(2000).optional().nullable(),
});

export const productoUpdateSchema = productoSchema.extend({ id: idSchema });

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  descripcion: optionalTextSchema(255),
  icono: z.string().trim().max(50).optional().nullable(),
  area: z.string().trim().max(20).optional().nullable(),
  activo: z.boolean().optional(),
});

export const categoriaUpdateSchema = categoriaSchema.partial().extend({
  id: idSchema,
});

export const mesaSchema = z.object({
  numero: z.string().trim().min(1).max(20),
  capacidad: z.coerce.number().int().positive().max(100).optional(),
  zona: z.string().trim().max(50).optional().nullable(),
  estado: z
    .enum(["Libre", "Ocupada", "Reservada", "Mantenimiento"])
    .optional(),
});

export const mesaUpdateSchema = mesaSchema.partial().extend({ id: idSchema });

export const cuponSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  tipo: z.enum(["Porcentaje", "Monto"]),
  valor: positiveMoneySchema,
  validoDesde: z.string().trim().min(1).optional().nullable(),
  validoHasta: z.string().trim().min(1).optional().nullable(),
  usosMaximos: z.coerce.number().int().positive().optional().nullable(),
  activo: z.boolean().optional(),
});

export const cuponUpdateSchema = cuponSchema.partial().extend({ id: idSchema });

export const reservaSchema = z.object({
  clienteNombre: z.string().trim().min(1).max(100),
  clienteTelefono: z.string().trim().min(6).max(20),
  fechaReserva: limaDateSchema,
  numPersonas: z.coerce.number().int().positive().max(100),
  mesaId: idSchema,
});

export const reservaEstadoSchema = z.object({
  id: idSchema,
  nuevoEstado: z.enum(["Confirmada", "Finalizada", "Cancelada"]),
});

export const llamadoSchema = z.object({
  mesaId: idSchema,
});

export const atenderLlamadoSchema = z.object({
  llamadoId: idSchema,
});

export const confirmarPedidoSchema = z.object({
  pedidoId: idSchema,
});

export const publicPedidoSchema = z.object({
  mesaId: idSchema,
  items: z
    .array(
      z.object({
        id: idSchema,
        cantidad: z.coerce.number().int().positive(),
      })
    )
    .min(1),
});

export const detalleSchema = z.object({
  pedidoId: idSchema,
  items: z
    .array(
      z.object({
        id: idSchema,
        cantidad: z.coerce.number().int().positive(),
      })
    )
    .min(1),
});

export const comandaEstadoSchema = z.object({
  detalleId: idSchema,
  nuevoEstado: detailStatusInputSchema,
});

export const pedidoEstadoSchema = z.object({
  pedidoId: idSchema,
  estado: z.enum([ORDER_STATUS.SERVIDO, ORDER_STATUS.POR_COBRAR]),
});

export const cobrarPedidoSchema = z.object({
  pedidoId: idSchema,
  metodoPago: paymentMethodSchema,
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type PagoPedidoInput = z.infer<typeof pagoPedidoSchema>;
export type DescuentoInput = z.infer<typeof descuentoSchema>;
export type DevolucionInput = z.infer<typeof devolucionSchema>;
export type AnulacionInput = z.infer<typeof anulacionSchema>;
export type MovimientoCajaInput = z.infer<typeof movimientoCajaSchema>;
export type CerrarCajaInput = z.infer<typeof cerrarCajaSchema>;
export type ConciliarInput = z.infer<typeof conciliarSchema>;
export type AbrirCajaInput = z.infer<typeof abrirCajaSchema>;
export type ProductoInput = z.infer<typeof productoSchema>;
export type ProductoUpdateInput = z.infer<typeof productoUpdateSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type CategoriaUpdateInput = z.infer<typeof categoriaUpdateSchema>;
export type MesaInput = z.infer<typeof mesaSchema>;
export type MesaUpdateInput = z.infer<typeof mesaUpdateSchema>;
export type ReservaInput = z.infer<typeof reservaSchema>;
export type ReservaEstadoInput = z.infer<typeof reservaEstadoSchema>;
export type LlamadoInput = z.infer<typeof llamadoSchema>;
export type AtenderLlamadoInput = z.infer<typeof atenderLlamadoSchema>;
export type ConfirmarPedidoInput = z.infer<typeof confirmarPedidoSchema>;
export type DetalleInput = z.infer<typeof detalleSchema>;
export type ComandaEstadoInput = z.infer<typeof comandaEstadoSchema>;
export type PedidoEstadoInput = z.infer<typeof pedidoEstadoSchema>;
export type CobrarPedidoInput = z.infer<typeof cobrarPedidoSchema>;
export type DetailStatusValue = DetailStatus;
