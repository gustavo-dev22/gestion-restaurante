export const RESERVATION_SLOT_MS = 2 * 60 * 60 * 1000;

export function getFranjaInicio(fecha: Date): Date {
  return new Date(Math.floor(fecha.getTime() / RESERVATION_SLOT_MS) * RESERVATION_SLOT_MS);
}

export function getFranjaFin(fecha: Date): Date {
  return new Date(getFranjaInicio(fecha).getTime() + RESERVATION_SLOT_MS);
}
