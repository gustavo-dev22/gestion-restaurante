import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Zona horaria operativa del restaurante. */
export const RESTAURANT_TIME_ZONE = "America/Lima";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Las fechas de SASI/SQL Server se guardan como hora local del restaurante y
 * Prisma las serializa como UTC. Para mostrar la hora tal cual fue registrada
 * formateamos en UTC; para medir tiempos transcurridos normalizamos "ahora"
 * al huso del restaurante.
 */
function getRestaurantOffsetMinutes(date = new Date()): number {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: RESTAURANT_TIME_ZONE,
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((item) => item.type === "timeZoneName")?.value;

    const match = part?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;

    const [, sign, hours, minutes] = match;
    const total = Number(hours) * 60 + Number(minutes ?? 0);
    return sign === "-" ? -total : total;
  } catch {
    return 0;
  }
}

export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumber(value: number | string | null | undefined, fractionDigits = 0) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: DateInput) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: DateInput) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatTime(value: DateInput) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/** Devuelve el tiempo transcurrido en formato legible desde una fecha de la API. */
export function timeAgo(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "—";

  const offsetMs = getRestaurantOffsetMinutes() * 60_000;
  // "Ahora" expresado en la misma base que la fecha serializada (hora local del restaurante como UTC).
  const nowAsRestaurantWallClock = Date.now() + offsetMs;
  let minutes = Math.floor((nowAsRestaurantWallClock - date.getTime()) / 60_000);
  if (minutes < 0) minutes = 0;

  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h ${remainingMinutes}m`;
}
