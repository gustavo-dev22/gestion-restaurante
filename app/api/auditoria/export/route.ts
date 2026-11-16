import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { buildAuditWhere, parseAuditFilters } from "@/lib/audit-filters";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const auth = await authorizeLocal(request, "audit:export");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const filters = parseAuditFilters(searchParams);
  const where = buildAuditWhere(filters);

  const rows = await prisma.auditoria.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  const headers = [
    "id",
    "fecha",
    "actorId",
    "actorNombre",
    "actorRol",
    "ip",
    "userAgent",
    "accion",
    "entidad",
    "entidadId",
    "motivo",
    "requestId",
    "turnoId",
    "antes",
    "despues",
  ];

  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.createdAt.toISOString(),
        row.actorId,
        row.actorNombre,
        row.actorRol,
        row.ip,
        row.userAgent,
        row.accion,
        row.entidad,
        row.entidadId,
        row.motivo,
        row.requestId,
        row.turnoId,
        row.antes,
        row.despues,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
