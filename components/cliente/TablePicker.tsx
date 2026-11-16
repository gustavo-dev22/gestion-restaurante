"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, Home, Loader2, Lock, QrCode, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { http, getErrorMessage } from "@/lib/http";
import { setMesaGuardada, useMesaGuardada } from "@/lib/cliente-mesa-storage";
import { cn } from "@/lib/utils";

interface MesaPublica {
  id: number;
  numero: string;
  zona: string | null;
  capacidad: number | null;
  estado: string;
}

interface TablePickerProps {
  mode: "menu" | "orden";
}

export default function TablePicker({ mode }: TablePickerProps) {
  const router = useRouter();
  const [mesas, setMesas] = useState<MesaPublica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mesaGuardada = useMesaGuardada();

  useEffect(() => {
    if (mode === "orden" && mesaGuardada && /^\d+$/.test(mesaGuardada)) {
      router.replace(`/cliente/mesa/${mesaGuardada}`);
    }
  }, [mesaGuardada, mode, router]);

  useEffect(() => {
    let active = true;
    http
      .get<MesaPublica[]>("/api/public/mesas", { skipAuthRedirect: true })
      .then((data) => {
        if (!active) return;
        setMesas(
          (Array.isArray(data) ? data : []).filter((mesa) => mesa.estado !== "Mantenimiento")
        );
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "No se pudieron cargar las mesas."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const abrirMesa = (mesaId: number) => {
    setMesaGuardada(String(mesaId));
    router.push(`/cliente/mesa/${mesaId}`);
  };

  const title = mode === "menu" ? "Carta Digital" : "Mi Orden";
  const description =
    mode === "menu"
      ? "Selecciona tu mesa para ver la carta y realizar tu pedido."
      : "Selecciona tu mesa para consultar el estado de tu pedido.";

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Volver al panel
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
          >
            <Home size={16} aria-hidden="true" />
            Inicio
          </Link>
        </div>

        <PageHeader title={title} description={description} />

        <Card className="mb-6 border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2.5 text-blue-600 shadow-sm">
              <QrCode size={22} aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">¿Estás en el restaurante?</h2>
              <p className="mt-1 text-sm text-slate-600">
                Escanea el código QR de tu mesa para abrir tu carta y tu orden directamente.
                Si el QR no funciona, selecciona tu mesa abajo.
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-white p-5">
            <Utensils size={18} className="text-blue-600" aria-hidden="true" />
            <h2 className="font-bold text-slate-800">Selecciona tu mesa</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm font-semibold text-slate-600">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Cargando mesas...
            </div>
          ) : error ? (
            <p className="p-8 text-center text-sm font-semibold text-rose-600">{error}</p>
          ) : mesas.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">
              No hay mesas disponibles en este momento.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {mesas.map((mesa) => {
                const esMia = mesaGuardada === String(mesa.id);
                const bloqueada = mesa.estado !== "Libre" && !esMia;

                return (
                  <button
                    key={mesa.id}
                    type="button"
                    disabled={bloqueada}
                    onClick={() => abrirMesa(mesa.id)}
                    aria-label={
                      bloqueada
                        ? `Mesa ${mesa.numero} no disponible para este cliente`
                        : `Abrir mesa ${mesa.numero}`
                    }
                    className={cn(
                      "group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      bloqueada
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70"
                        : "hover:border-blue-400 hover:shadow-md"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-black text-slate-800">Mesa {mesa.numero}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {mesa.zona || "Salón"} · {mesa.capacidad ?? 2} personas
                      </p>
                      {bloqueada && (
                        <p className="mt-1 text-xs font-semibold text-rose-600">
                          No disponible para este cliente
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge tone={esMia && mesa.estado !== "Libre" ? "blue" : mesa.estado === "Libre" ? "emerald" : "amber"}>
                        {esMia && mesa.estado !== "Libre" ? "Tu mesa" : mesa.estado}
                      </Badge>
                      {bloqueada ? (
                        <Lock size={16} className="text-slate-400" aria-hidden="true" />
                      ) : (
                        <ArrowRight
                          size={16}
                          className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
