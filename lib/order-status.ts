export const ORDER_STATUS = {
  BORRADOR: "BORRADOR",
  CONFIRMADO: "CONFIRMADO",
  EN_COCINA: "EN_COCINA",
  PARCIALMENTE_LISTO: "PARCIALMENTE_LISTO",
  LISTO: "LISTO",
  SERVIDO: "SERVIDO",
  POR_COBRAR: "POR_COBRAR",
  PAGADO: "PAGADO",
  CERRADO: "CERRADO",
  ANULADO: "ANULADO",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  BORRADOR: "Borrador",
  CONFIRMADO: "Confirmado",
  EN_COCINA: "En cocina",
  PARCIALMENTE_LISTO: "Parcialmente listo",
  LISTO: "Listo",
  SERVIDO: "Servido",
  POR_COBRAR: "Por cobrar",
  PAGADO: "Pagado",
  CERRADO: "Cerrado",
  ANULADO: "Anulado",
};

export const DETAIL_STATUS = {
  PENDIENTE: "PENDIENTE",
  EN_PREPARACION: "EN_PREPARACION",
  LISTO: "LISTO",
  SERVIDO: "SERVIDO",
} as const;

export type DetailStatus = (typeof DETAIL_STATUS)[keyof typeof DETAIL_STATUS];

export const DETAIL_STATUS_LABELS: Record<DetailStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  SERVIDO: "Servido",
};

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  BORRADOR: ["CONFIRMADO", "ANULADO"],
  CONFIRMADO: ["EN_COCINA", "ANULADO"],
  EN_COCINA: ["PARCIALMENTE_LISTO", "LISTO", "ANULADO"],
  PARCIALMENTE_LISTO: ["LISTO", "ANULADO"],
  LISTO: ["SERVIDO", "POR_COBRAR", "ANULADO"],
  SERVIDO: ["POR_COBRAR", "ANULADO"],
  POR_COBRAR: ["PAGADO", "ANULADO"],
  PAGADO: ["CERRADO"],
  CERRADO: [],
  ANULADO: [],
};

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  "BORRADOR",
  "CONFIRMADO",
  "EN_COCINA",
  "PARCIALMENTE_LISTO",
  "LISTO",
  "SERVIDO",
  "POR_COBRAR",
];

export const CHARGEABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "LISTO",
  "SERVIDO",
  "POR_COBRAR",
];

export const QR_ORDER_STATUS: OrderStatus = "BORRADOR";

export class OrderStatusError extends Error {
  status = 409;
  code = "TRANSICION_INVALIDA";

  constructor(message: string) {
    super(message);
    this.name = "OrderStatusError";
  }
}

const ORDER_STATUS_VALUES = new Set<string>(Object.values(ORDER_STATUS));
const DETAIL_STATUS_VALUES = new Set<string>(Object.values(DETAIL_STATUS));

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUS_VALUES.has(value);
}

export function isDetailStatus(value: string): value is DetailStatus {
  return DETAIL_STATUS_VALUES.has(value);
}

export function normalizeOrderStatus(
  value: string | null | undefined
): OrderStatus {
  if (value && isOrderStatus(value)) return value;
  if (value === "Por Confirmar") return "BORRADOR";
  if (value === "Pendiente") return "CONFIRMADO";
  if (value === "Pagado") return "PAGADO";
  if (value === "Expirado" || value === "Llamado" || value === "Atendido") {
    return "ANULADO";
  }
  return "BORRADOR";
}

export function normalizeDetailStatus(
  value: string | null | undefined
): DetailStatus {
  if (value && isDetailStatus(value)) return value;
  if (value === "Listo") return "LISTO";
  if (value === "Pendiente" || !value) return "PENDIENTE";
  return "PENDIENTE";
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus
): void {
  if (!canTransition(from, to)) {
    throw new OrderStatusError(
      `No se puede cambiar el pedido de ${ORDER_STATUS_LABELS[from]} a ${ORDER_STATUS_LABELS[to]}.`
    );
  }
}

export function canTransitionDetail(
  from: DetailStatus,
  to: DetailStatus
): boolean {
  if (from === "SERVIDO") return false;
  if (from === to) return true;
  if (from === "PENDIENTE") return to === "EN_PREPARACION" || to === "LISTO";
  if (from === "EN_PREPARACION") return to === "LISTO";
  if (from === "LISTO") return to === "SERVIDO";
  return false;
}

export function assertDetailTransition(
  from: DetailStatus,
  to: DetailStatus
): void {
  if (!canTransitionDetail(from, to)) {
    throw new OrderStatusError(
      `No se puede cambiar el plato de ${DETAIL_STATUS_LABELS[from]} a ${DETAIL_STATUS_LABELS[to]}.`
    );
  }
}

export interface DetailStatusLike {
  estado: string;
}

/**
 * Calcula el estado del pedido a partir del estado de sus platos.
 * No pisa estados terminales o de cobro; esos se cambian explícitamente.
 */
export function deriveOrderStatus(
  detalles: DetailStatusLike[],
  current?: OrderStatus
): OrderStatus {
  if (current === "PAGADO" || current === "CERRADO" || current === "ANULADO") {
    return current;
  }
  if (detalles.length === 0) return "CONFIRMADO";

  const states = detalles.map((detalle) => normalizeDetailStatus(detalle.estado));
  const todosListos = states.every((estado) => estado === "LISTO");
  const todosServidos = states.every((estado) => estado === "SERVIDO");
  const algunListo = states.some((estado) => estado === "LISTO" || estado === "SERVIDO");
  const algunEnPreparacion = states.some((estado) => estado === "EN_PREPARACION");

  if (todosServidos) return "SERVIDO";
  if (todosListos) return "LISTO";
  if (algunListo) return "PARCIALMENTE_LISTO";
  if (algunEnPreparacion) return "EN_COCINA";
  return "CONFIRMADO";
}
