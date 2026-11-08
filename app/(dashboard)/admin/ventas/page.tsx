"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Printer, Receipt, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { DataTable, DataTablePagination } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { http } from "@/lib/http";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const ITEMS_PER_PAGE = 8;

export default function VentasPage() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState("hoy");
  const [detalle, setDetalle] = useState<any | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchConFiltro = async () => {
      setLoading(true);
      try {
        const data = await http.get<any[]>(`/api/admin/ventas?rango=${rango}`);
        setVentas(Array.isArray(data) ? data : []);
        setPage(1);
      } catch {
        setVentas([]);
      } finally {
        setLoading(false);
      }
    };
    fetchConFiltro();
  }, [rango]);

  const ventasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return ventas;
    return ventas.filter((venta) => {
      const ticket = `#${String(venta.id).padStart(4, "0")}`.toLowerCase();
      return (
        ticket.includes(term) ||
        String(venta.id).includes(term) ||
        String(venta.mesa?.numero ?? "").toLowerCase().includes(term)
      );
    });
  }, [ventas, busqueda]);

  const totalPages = Math.max(1, Math.ceil(ventasFiltradas.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const ventasPagina = ventasFiltradas.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalIngresos = ventasFiltradas.reduce((acc, venta) => acc + Number(venta.total), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Historial de Ventas"
        description="Registro de todos los pedidos liquidados"
        actions={
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Total Ingresos</p>
            <p className="text-2xl font-black text-emerald-700">{formatCurrency(totalIngresos)}</p>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
          {["hoy", "ayer", "semana", "mes"].map((filtro) => (
            <button
              key={filtro}
              type="button"
              onClick={() => setRango(filtro)}
              aria-pressed={rango === filtro}
              className={`rounded-lg px-4 py-2 text-sm font-bold capitalize transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                rango === filtro ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {filtro}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={18}
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Buscar por ticket o mesa..."
            aria-label="Buscar ventas"
            className="pl-10"
            value={busqueda}
            onChange={(event) => {
              setBusqueda(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <DataTable>
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Ticket</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Fecha y Hora</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Mesa</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Total</th>
              <th className="px-6 py-4 text-center text-xs font-bold uppercase text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </td>
              </tr>
            ) : ventasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={Receipt}
                    title="Sin ventas en este periodo"
                    description="No se encontraron pedidos liquidados para el rango o búsqueda seleccionados."
                  />
                </td>
              </tr>
            ) : (
              ventasPagina.map((venta) => (
                <tr key={venta.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 font-bold text-blue-700">
                    #{String(venta.id).padStart(4, "0")}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {formatDateTime(venta.fecha_creacion)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone="neutral">{venta.mesa.numero}</Badge>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {formatCurrency(venta.total)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <IconButton
                        label={`Ver detalle de la venta ${venta.id}`}
                        variant="primary"
                        onClick={() => setDetalle(venta)}
                      >
                        <Eye size={18} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>

        {!loading && ventasFiltradas.length > 0 && (
          <DataTablePagination
            page={currentPage}
            totalPages={totalPages}
            onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            info={
              <span>
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, ventasFiltradas.length)} de{" "}
                {ventasFiltradas.length}
              </span>
            }
          />
        )}
      </div>

      <Modal
        open={Boolean(detalle)}
        onClose={() => setDetalle(null)}
        title={detalle ? `Detalle de venta #${String(detalle.id).padStart(4, "0")}` : "Detalle de venta"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDetalle(null)}>
              Cerrar
            </Button>
            <Button type="button" onClick={() => window.print()}>
              <Printer size={18} /> Imprimir
            </Button>
          </>
        }
      >
        {detalle && (
          <div className="print-area space-y-1">
            <div className="mb-4 border-b-2 border-slate-800 pb-2">
              <h2 className="text-lg font-black text-slate-900">Gestión Restaurante</h2>
              <p className="text-sm text-slate-600">Comprobante de venta</p>
              <p className="text-sm font-semibold text-slate-900">
                Ticket #{String(detalle.id).padStart(4, "0")}
              </p>
            </div>
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-slate-600">Mesa:</span>
              <span className="font-semibold text-slate-800">{detalle.mesa.numero}</span>
            </div>
            <div className="mb-4 flex justify-between text-sm">
              <span className="text-slate-600">Fecha:</span>
              <span className="font-semibold text-slate-800">
                {formatDateTime(detalle.fecha_creacion)}
              </span>
            </div>

            <div className="space-y-2 border-t border-dashed border-slate-200 pt-3">
              {detalle.detalles.map((item: any) => (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-700">
                    {item.cantidad} x {item.producto.nombre}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(item.cantidad * Number(item.precio_unitario))}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between border-t-2 border-slate-800 pt-3 text-lg">
              <span className="font-bold text-slate-800">Total</span>
              <span className="font-black text-blue-700">{formatCurrency(detalle.total)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
