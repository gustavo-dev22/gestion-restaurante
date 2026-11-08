'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Utensils, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { PageHeader } from '@/components/ui/PageHeader';
import { toastError } from '@/components/ui/Toast';

export default function NuevoPedidoQuickPage() {
  const [mesasLibres, setMesasLibres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const router = useRouter();

  const usuario = useAuthStore((state) => state.user);

  useEffect(() => {
    fetch('/api/mesas')
      .then(res => res.json())
      .then(data => {
        // Solo mostramos las mesas que están LIBRES
        setMesasLibres(data.filter((m: any) => m.estado === 'Libre'));
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
      const res = await fetch('/api/mesero/salon', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesaId, usuarioId: usuario.id, nombreMesero: usuario.nombreCompleto }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      router.push(`/mesero/pedido/${data.pedido.id}`);
    } catch {
      toastError("No se pudo abrir la mesa", "Intenta nuevamente en unos segundos.");
      setOpeningId(null);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div>;

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