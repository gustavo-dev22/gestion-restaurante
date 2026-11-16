import {
  ACTIVE_ORDER_STATUSES,
  QR_ORDER_STATUS,
  type OrderStatus,
} from "@/lib/order-status";

/** Tiempo máximo que un pedido QR puede esperar a ser reclamado por un mesero. */
export const QR_PENDING_TTL_MS = 5 * 60 * 1000;

/** Pedido QR recién creado, pendiente de que un mesero lo tome. */
export const QR_PENDING_STATUS: OrderStatus = QR_ORDER_STATUS;

/** Estados de pedido considerados "activos" para una mesa. */
export const ACTIVE_ORDER_STATES: readonly OrderStatus[] = ACTIVE_ORDER_STATUSES;
