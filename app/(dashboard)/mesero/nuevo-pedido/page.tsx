'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Utensils, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { toastError } from '@/components/ui/Toast';
import { http, getErrorMessage } from '@/lib/http';

interface MesaLibre {
  id: number;
  numero: string;
  estado: string;
  zona: string;
  capacidad: number;
}
export default function NuevoPedidoQuickPage() {
  const [mesasLibres, setMesasLibres] = useState<MesaLibre[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const router = useRouter();

  const usuario = useAuthStore((state) => state.user);

  useEffect(() => {
    http
      .get<MesaLibre[]>('/api/mesas')
      .then((data) => {
        setMesasLibres(data.filter((mesa) => mesa.estado === 'Libre'));
      })
      .catch(() => {
        setMesasLibres([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const abrirMesaRapido = async (mesaId: number) => {
    if (!usuario?.id) {
      toastError("Sesión no válida", "No se pudo identificar al mesero.");
      return;
    }

    setOpeningId(mesaId);
    try {
      const data = await http.patch<{ pedido: { id: number } }>('/api/mesero/salon', {
        mesaId,
        usuarioId: usuario.id,
        nombreMesero: usuario.nombreCompleto,
      });

      router.push(`/mesero/pedido/${data.pedido.id}`);
    } catch (error) {
      toastError("No se pudo abrir la mesa", getErrorMessage(error, "Intenta nuevamente en unos segundos."));
      setOpeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-2 h-8 w-72" />
        <Skeleton className="mb-6 h-4 w-96" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Toma de Pedido Rápida"
        description="Selecciona una mesa disponible para comenzar"
      />

      <div className="grid grid-cols-1 gap-4">
        {mesasLibres.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 p-10 rounded-3xl text-center text-amber-700">
            <p className="font-bold">No hay mesas libres en este momento.</p>
            <p className="text-sm">Libera una mesa desde el Salón para iniciar un nuevo pedido.</p>
          </div>
        ) : (
          mesasLibres.map((mesa) => (
            <button
              key={mesa.id}
              type="button"
              disabled={openingId === mesa.id}
              onClick={() => abrirMesaRapido(mesa.id)}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-slate-100 p-3 text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                  <Utensils size={24} />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-slate-800">{mesa.numero}</p>
                  <p className="text-sm text-slate-600">{mesa.zona} • Capacidad: {mesa.capacidad}</p>
                </div>
              </div>
              {openingId === mesa.id ? (
                <Loader2 className="animate-spin text-blue-600" size={20} />
              ) : (
                <ArrowRight className="text-slate-500 transition-colors group-hover:text-blue-500" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}