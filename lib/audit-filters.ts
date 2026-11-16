import type { Prisma } from "@prisma/client";

export interface AuditFilters {
  page: number;
  actor: string;
  accion: string;
  entidad: string;
  entidadId: string;
  motivo: string;
  desde: string;
  hasta: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function text(params: URLSearchParams, key: string): string {
  return (params.get(key) ?? "").trim();
}

function parsePage(value: string): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseDate(value: string, endOfDay = false): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseAuditFilters(params: URLSearchParams): AuditFilters {
  return {
    page: parsePage(params.get("page") ?? "1"),
    actor: text(params, "actor").slice(0, 100),
    accion: text(params, "accion").slice(0, 100),
    entidad: text(params, "entidad").slice(0, 50),
    entidadId: text(params, "entidadId").slice(0, 100),
    motivo: text(params, "motivo").slice(0, 100),
    desde: text(params, "desde"),
    hasta: text(params, "hasta"),
  };
}

export function buildAuditWhere(filters: AuditFilters): Prisma.AuditoriaWhereInput {
  const conditions: Prisma.AuditoriaWhereInput[] = [];

  if (filters.actor) {
    conditions.push({
      OR: [
        { actorNombre: { contains: filters.actor } },
        { actorId: { contains: filters.actor } },
      ],
    });
  }
  if (filters.accion) {
    conditions.push({ accion: { contains: filters.accion } });
  }
  if (filters.entidad) {
    conditions.push({ entidad: { contains: filters.entidad } });
  }
  if (filters.entidadId) {
    conditions.push({ entidadId: { contains: filters.entidadId } });
  }
  if (filters.motivo) {
    conditions.push({ motivo: { contains: filters.motivo } });
  }

  const desde = parseDate(filters.desde);
  const hasta = parseDate(filters.hasta, true);
  if (desde || hasta) {
    conditions.push({
      createdAt: {
        ...(desde ? { gte: desde } : {}),
        ...(hasta ? { lte: hasta } : {}),
      },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export function auditFiltersToQuery(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.accion) params.set("accion", filters.accion);
  if (filters.entidad) params.set("entidad", filters.entidad);
  if (filters.entidadId) params.set("entidadId", filters.entidadId);
  if (filters.motivo) params.set("motivo", filters.motivo);
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  return params;
}
