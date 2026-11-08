import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Zona horaria operativa del restaurante. */
export const RESTAURANT_TIME_ZONE = "America/Lima";
/** Perú no aplica horario de verano: UTC-05:00 todo el año. */
const PERU_UTC_OFFSET_HOURS = 5;

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    timeZone: RESTAURANT_TIME_ZONE,
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
    timeZone: RESTAURANT_TIME_ZONE,
  }).format(date);
}

export function formatTime(value: DateInput) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: RESTAURANT_TIME_ZONE,
  }).format(date);
}

/** Devuelve el tiempo transcurrido en formato legible desde una fecha de la API. */
export function timeAgo(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "—";

  let minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
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

export interface PeruDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Descompone una fecha en sus componentes de calendario en hora de Perú. */
export function getPeruDateParts(value: DateInput = new Date()): PeruDateParts {
  const date = toDate(value) ?? new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function getPeruHour(value: DateInput = new Date()): number {
  return getPeruDateParts(value).hour;
}

/**
 * Inicio del día en Perú (00:00 -05:00) expresado como instante UTC.
 * `daysAgo` permite obtener el inicio de ayer, de hace 7 días, etc.
 */
export function peruStartOfDay(daysAgo = 0, base: DateInput = new Date()): Date {
  const { year, month, day } = getPeruDateParts(base);
  return new Date(
    Date.UTC(year, month - 1, day - daysAgo, PERU_UTC_OFFSET_HOURS, 0, 0, 0)
  );
}

export function peruEndOfDay(daysAgo = 0, base: DateInput = new Date()): Date {
  return new Date(peruStartOfDay(daysAgo + 1, base).getTime() - 1);
}

/**
 * Parsea un valor `datetime-local` (ej. "2026-11-08T15:30") asumiendo que
 * representa hora de Perú. No depende de la zona horaria del servidor/contenedor.
 * Si el string ya incluye offset o "Z", se respeta tal cual.
 */
export function parseLimaDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const explicit = new Date(trimmed);
    return Number.isNaN(explicit.getTime()) ? null : explicit;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day, hour, minute, second] = match;
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + PERU_UTC_OFFSET_HOURS,
    Number(minute),
    Number(second ?? 0)
  );

  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Devuelve la fecha/hora actual de Perú en formato `datetime-local`. */
export function toLimaInputValue(date: DateInput = new Date()): string {
  const parts = getPeruDateParts(date);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
