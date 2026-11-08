"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle, Clock, Phone, Search, User, Users, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTablePagination } from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toastSuccess, toastError } from "@/components/ui/Toast";
import { http } from "@/lib/http";
import { formatDateTime } from "@/lib/utils";
import { useDebounce } from "@/lib/useDebounce";

interface Reserva {
  id: number;
  mesaId: number;
  clienteNombre: string;
  clienteTelefono: string;
  fechaReserva: string;
  numPersonas: number;
  estado: string;
  mesa: { numero: string };
}
const ITEMS_PER_PAGE = 6;

export default function GestionReservasPage() {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ id: number; mesaId: number; estado: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const busquedaDebounced = useDebounce(busqueda, 300);
  const [page, setPage] = useState(1);

  const fetchReservas = async () => {
    try {
      const data = await http.get<Reserva[]>("/api/admin/reservas");
      setReservas(Array.isArray(data) ? data : []);
    } catch {
      setReservas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservas();
  }, []);

  const cambiarEstado = async () => {
    if (!pending) return;
    setUpdating(true);
    try {
      await http.patch("/api/admin/reservas", {
        id: pending.id,
        nuevoEstado: pending.estado,
        mesaId: pending.mesaId,
      });

      toastSuccess("Reserva actualizada", `Reserva marcada como ${pending.estado}.`);
      setPending(null);
      fetchReservas();
    } catch {
      toastError("No se pudo actualizar", "Intenta nuevamente en unos segundos.");
    } finally {
      setUpdating(false);
    }
  };

  const reservasFiltradas = useMemo(() => {
    const term = busquedaDebounced.trim().toLowerCase();
    if (!term) return reservas;

    return reservas.filter((reserva) => {
      return (
        String(reserva.clienteNombre ?? "").toLowerCase().includes(term) ||
        String(reserva.clienteTelefono ?? "").toLowerCase().includes(term) ||
        String(reserva.mesa?.numero ?? "").toLowerCase().includes(term) ||
        String(reserva.estado ?? "").toLowerCase().includes(term)
      );
    });
  }, [reservas, busquedaDebounced]);

  const totalPages = Math.max(1, Math.ceil(reservasFiltradas.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const reservasPagina = reservasFiltradas.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Control de Reservas"
        description="Administra las llegadas y disponibilidad de mesas reservadas"
      />

      <div className="relative mb-6 max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          size={18}
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Buscar por cliente, teléfono, mesa o estado..."
          aria-label="Buscar reservas"
          className="pl-10"
          value={busqueda}
          onChange={(event) => {
            setBusqueda(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-6">
              <Skeleton className="mb-4 h-10 w-10 rounded-xl" />
              <Skeleton className="mb-2 h-5 w-2/3" />
              <Skeleton className="mb-1 h-4 w-full" />
              <Skeleton className="mb-1 h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : reservasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState
            icon={CalendarDays}
            title="Sin reservas"
            description="No hay reservas que coincidan con la búsqueda."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reservasPagina.map((reserva) => (
              <div
                key={reserva.id}
                className={`rounded-2xl border-2 bg-white p-6 transition-all ${
                  reserva.estado === "Confirmada" ? "border-amber-100" : "border-slate-100 opacity-70"
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                    <User size={24} aria-hidden="true" />
                  </div>
                  <Badge
                    tone={
                      reserva.estado === "Confirmada"
                        ? "amber"
                        : reserva.estado === "Finalizada"
                          ? "emerald"
                          : "rose"
                    }
                  >
                    {reserva.estado}
                  </Badge>
                </div>

                <h3 className="mb-1 text-xl font-bold text-slate-800">{reserva.clienteNombre}</h3>
                <div className="mb-6 space-y-2">
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} /> {reserva.clienteTelefono}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={14} /> {formatDateTime(reserva.fechaReserva)}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Users size={14} /> {reserva.numPersonas} personas · <b>Mesa {reserva.mesa.numero}</b>
                  </p>
                </div>

                {reserva.estado === "Confirmada" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPending({ id: reserva.id, mesaId: reserva.mesaId, estado: "Finalizada" })
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <CheckCircle size={14} /> Llegó
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPending({ id: reserva.id, mesaId: reserva.mesaId, estado: "Cancelada" })
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-rose-50 py-2 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <XCircle size={14} /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <DataTablePagination
              page={currentPage}
              totalPages={totalPages}
              onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              info={
                <span>
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, reservasFiltradas.length)} de{" "}
                  {reservasFiltradas.length} reservas
                </span>
              }
            />
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={cambiarEstado}
        title={pending ? `¿Marcar como ${pending.estado}?` : "Actualizar reserva"}
        description="Esto actualizará la disponibilidad de la mesa en el salón."
        confirmLabel="Confirmar"
        variant={pending?.estado === "Cancelada" ? "danger" : "success"}
        loading={updating}
      />
    </div>
  );
}
