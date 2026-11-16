import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServerPagination } from "@/components/ui/ServerPagination";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth/server-session";
import { getLocalUserContext } from "@/lib/rbac";
import {
  auditFiltersToQuery,
  buildAuditWhere,
  parseAuditFilters,
} from "@/lib/audit-filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function toSearchParams(
  values: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Lima",
  }).format(value);
}

function formatJson(value: string | null): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const context = await getLocalUserContext(session);
  if (!context?.permissions.has("audit:read")) {
    redirect(session.home || "/dashboard");
  }

  const resolved = await searchParams;
  const params = toSearchParams(resolved);
  const filters = parseAuditFilters(params);
  const where = buildAuditWhere(filters);

  const total = await prisma.auditoria.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const rows = await prisma.auditoria.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const query = Object.fromEntries(auditFiltersToQuery(filters).entries());
  const exportQuery = auditFiltersToQuery(filters).toString();
  const canExport = context.permissions.has("audit:export");

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Registro de Auditoría"
        description="Consulta inmutable de las acciones sensibles del sistema."
        actions={
          canExport ? (
            <Link
              href={`/api/auditoria/export${exportQuery ? `?${exportQuery}` : ""}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <Download size={16} aria-hidden="true" />
              Exportar CSV
            </Link>
          ) : (
            <Badge tone="neutral">Solo lectura</Badge>
          )
        }
      />

      <Card className="mb-6 p-4">
        <form method="get" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            Actor
            <input
              name="actor"
              defaultValue={filters.actor}
              placeholder="Nombre o ID SASI"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Acción
            <input
              name="accion"
              defaultValue={filters.accion}
              placeholder="payment.refund"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Entidad
            <input
              name="entidad"
              defaultValue={filters.entidad}
              placeholder="Pago, Pedido, Caja..."
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            ID entidad
            <input
              name="entidadId"
              defaultValue={filters.entidadId}
              placeholder="123"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Motivo
            <input
              name="motivo"
              defaultValue={filters.motivo}
              placeholder="Anulación, descuento..."
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Desde
            <input
              type="date"
              name="desde"
              defaultValue={filters.desde}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Hasta
            <input
              type="date"
              name="hasta"
              defaultValue={filters.hasta}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Search size={16} aria-hidden="true" />
              Filtrar
            </button>
            <Link
              href="/auditoria"
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </Card>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <DataTable label="Registro de auditoría" minWidthClass="min-w-[1100px]">
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Acción</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Entidad</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Motivo</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-500">
                  No hay registros de auditoría con esos filtros.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <p className="font-semibold text-slate-800">
                      {row.actorNombre || row.actorId || "Sistema"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.actorRol || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <code className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {row.accion}
                    </code>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <p>{row.entidad || "—"}</p>
                    <p className="text-xs text-slate-500">{row.entidadId || ""}</p>
                  </td>
                  <td className="max-w-[260px] px-4 py-4 text-sm text-slate-700">
                    {row.motivo || "—"}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700">
                    <details>
                      <summary className="cursor-pointer font-semibold text-blue-700">
                        Ver detalle
                      </summary>
                      <div className="mt-2 space-y-3 text-xs">
                        <div>
                          <p className="font-bold uppercase text-slate-500">Antes</p>
                          <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-slate-100">
                            {formatJson(row.antes)}
                          </pre>
                        </div>
                        <div>
                          <p className="font-bold uppercase text-slate-500">Después</p>
                          <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-slate-100">
                            {formatJson(row.despues)}
                          </pre>
                        </div>
                        <dl className="grid gap-1 text-slate-500">
                          <div>
                            <dt className="inline font-semibold">IP: </dt>
                            <dd className="inline">{row.ip || "—"}</dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">Request ID: </dt>
                            <dd className="inline">{row.requestId || "—"}</dd>
                          </div>
                          <div>
                            <dt className="inline font-semibold">User-Agent: </dt>
                            <dd className="inline break-all">{row.userAgent || "—"}</dd>
                          </div>
                        </dl>
                      </div>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
        <ServerPagination
          page={currentPage}
          totalPages={totalPages}
          basePath="/auditoria"
          query={query}
        />
      </div>
      <p className="mt-3 text-sm text-slate-500">
        {total} registro{total === 1 ? "" : "s"}. Retención indefinida y sin edición.
      </p>
    </div>
  );
}
