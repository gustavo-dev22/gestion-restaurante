'use client';
import { useEffect, useState } from 'react';
import { LayoutGrid, Loader2, Users, CalendarCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import NotificacionesMesero from '@/components/mesero/notificacionesMesero';
import { PageHeader } from '@/components/ui/PageHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toastInfo, toastWarning, toastError } from '@/components/ui/Toast';

export default function SalonMeseroPage() {
  const [mesas, setMesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const usuario = useAuthStore((state) => state.user);

  const fetchMesas = async () => {
    const res = await fetch('/api/mesas');
    const data = await res.json();
    setMesas(data);
    setLoading(false);
  };

  useEffect(() => { fetchMesas(); }, []);

  // LÓGICA DE COLORES DINÁMICOS
  const getEstiloMesa = (estado: string) => {
    switch (estado) {
      case 'Libre': return 'border-emerald-100 bg-white hover:border-emerald-400';
      case 'Ocupada': return 'border-rose-100 bg-rose-50';
      case 'Reservada': return 'border-amber-300 bg-amber-50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'; 
      default: return 'border-slate-100 bg-slate-50';
    }
  };

  const getBadgeEstilo = (estado: string) => {
    switch (estado) {
      case 'Libre': return 'bg-emerald-100 text-emerald-700';
      case 'Ocupada': return 'bg-rose-100 text-rose-700';
      case 'Reservada': return 'bg-amber-100 text-amber-700 border border-amber-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const [openTarget, setOpenTarget] = useState<any | null>(null);
  const [opening, setOpening] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const abrirMesa = async () => {
    if (!openTarget) return;
    setOpening(true);
    try {
      const res = await fetch("/api/mesero/salon", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesaId: openTarget.id,
          usuarioId: usuario.id,
          nombreMesero: usuario.nombreCompleto,
        }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      setOpenTarget(null);
      router.push(`/mesero/pedido/${data.pedido.id}`);
    } catch {
      toastError("No se pudo abrir la mesa", "Intenta nuevamente en unos segundos.");
    } finally {
      setOpening(false);
    }
  };

  const handleInteraccionMesa = async (mesa: any) => {
    if (mesa.estado === "Libre") {
      setOpenTarget(mesa);
      return;
    }

    if (mesa.estado === "Reservada") {
      toastInfo(
        "Mesa reservada",
        "Tiene una reserva programada. Solo el administrador puede habilitarla cuando llegue el cliente."
      );
      return;
    }

    if (mesa.estado === "Ocupada") {
      setCheckingId(mesa.id);
      try {
        const res = await fetch(`/api/mesero/pedido/activo?mesaId=${mesa.id}`);
        const data = await res.json();

        if (data.pedidoId) {
          if (data.usuarioId !== usuario.id) {
            toastWarning(
              "Mesa restringida",
              `Atendida por ${data.nombreMesero || "otro mesero"}. Solo el responsable puede gestionarla.`
            );
            return;
          }
          router.push(`/mesero/pedido/resumen/${data.pedidoId}`);
        }
      } catch {
        toastError("No se pudo cargar la mesa", "Intenta nuevamente en unos segundos.");
      } finally {
        setCheckingId(null);
      }
    }
  };

  return (
    <div className="p-6">
      <NotificacionesMesero onPedidoAceptado={fetchMesas} />
      <PageHeader
        title="Salón Interactivo"
        description="Selecciona una mesa para gestionar el servicio"
      />

      {loading ? (
        <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {mesas.map((mesa) => (
            <button
              key={mesa.id}
              type="button"
              disabled={checkingId === mesa.id}
              onClick={() => handleInteraccionMesa(mesa)}
              aria-label={`Mesa ${mesa.numero}, estado ${mesa.estado}`}
              className={`relative rounded-2xl border-2 p-5 text-left transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-70 ${getEstiloMesa(mesa.estado)}`}
            >
              {checkingId === mesa.id && (
                <span className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                </span>
              )}
              <div className="mb-4 flex items-start justify-between">
                {mesa.estado === 'Reservada' ? (
                  <CalendarCheck className="text-amber-500" size={32} />
                ) : (
                  <LayoutGrid className={mesa.estado === 'Libre' ? 'text-emerald-500' : 'text-rose-500'} size={32} />
                )}
                
                <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${getBadgeEstilo(mesa.estado)}`}>
                  {mesa.estado}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-slate-800">{mesa.numero}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                <Users size={14} /> Capacidad: {mesa.capacidad}
              </p>

              {mesa.estado === 'Ocupada' && (
                <div className="mt-3 flex items-center gap-2 border-t border-rose-100 pt-3 text-xs font-bold uppercase text-rose-700">
                  <div className="rounded-full bg-rose-200 p-1">
                    <Users size={12} />
                  </div>
                  <span className="truncate">Atiende: {mesa.meseroNombre || 'Asignado'}</span>
                </div>
              )}

              {mesa.estado === 'Reservada' && (
                <div className="mt-3 border-t border-amber-200 pt-3 text-xs font-bold uppercase italic text-amber-700">
                  Bloqueada por reserva
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(openTarget)}
        onClose={() => setOpenTarget(null)}
        onConfirm={abrirMesa}
        title={openTarget ? `¿Abrir ${openTarget.numero}?` : "Abrir mesa"}
        description="Se iniciará un nuevo pedido para esta mesa."
        confirmLabel="Sí, abrir mesa"
        variant="success"
        loading={opening}
      />
    </div>
  );
}