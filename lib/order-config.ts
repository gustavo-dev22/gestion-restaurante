/** Tiempo máximo que un pedido QR puede esperar a ser reclamado por un mesero. */
export const QR_PENDING_TTL_MS = 5 * 60 * 1000;

/** Estados de pedido considerados "activos" para una mesa. */
export const ACTIVE_ORDER_STATES = ["Por Confirmar", "Pendiente"] as const;
