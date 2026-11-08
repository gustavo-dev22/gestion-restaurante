export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function toDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | number | Date | null | undefined) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString("es-PE");
}

export function formatTime(value: string | number | Date | null | undefined) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}
