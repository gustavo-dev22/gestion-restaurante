'use client';
import { useEffect, useState } from 'react';
import { LayoutGrid, Loader2, Users, CalendarCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import NotificacionesMesero from '@/components/mesero/notificacionesMesero';
import LlamadosMesero from '@/components/mesero/llamadosMesero';
import { PageHeader } from '@/components/ui/PageHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toastInfo, toastWarning, toastError } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { http, getErrorMessage } from '@/lib/http';

export default function SalonMeseroPage() {
  const [mesas, setMesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const usuario = useAuthStore((state) => state.user);

  const fetchMesas = async () => {
    try {
      const data = await http.get<any[]>('/api/mesas');
      setMesas(Array.isArray(data) ? data : []);
    } catch {
      setMesas([]);
    } finally {
      setLoading(false);
    }
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
      const data = await http.patch<{ pedido: { id: number } }>("/api/mesero/salon", {
        mesaId: openTarget.id,
        usuarioId: usuario.id,
        nombreMesero: usuario.nombreCompleto,
      });

      setOpenTarget(null);
      router.push(`/mesero/pedido/${data.pedido.id}`);
    } catch (error) {
      toastError("No se pudo abrir la mesa", getErrorMessage(error, "Intenta nuevamente en unos segundos."));
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
        const data = await http.get<{
          pedidoId?: number;
          usuarioId?: string;
          nombreMesero?: string;
        }>(`/api/mesero/pedido/activo?mesaId=${mesa.id}`);

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

      <LlamadosMesero />

      {loading ? (
        <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
      ) : mesas.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Sin mesas registradas"
          description="El administrador aún no ha configurado las mesas del salón."
        />
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