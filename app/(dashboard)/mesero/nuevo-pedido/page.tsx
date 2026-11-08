'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Utensils, Search, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import Swal from 'sweetalert2';

export default function NuevoPedidoQuickPage() {
  const [mesasLibres, setMesasLibres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const abrirMesaRapido = async (mesaId: number, numero: string) => {
    if (!usuario?.id) {
      return Swal.fire('Error de sesión', 'No se pudo identificar al mesero.', 'error');
    }

    Swal.fire({ title: 'Abriendo mesa...', didOpen: () => Swal.showLoading() });

    const res = await fetch('/api/mesero/salon', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId, usuarioId: usuario.id, nombreMesero: usuario.nombreCompleto })
    });

    if (res.ok) {
      const data = await res.json();
      Swal.close();
      router.push(`/mesero/pedido/${data.pedido.id}`);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin inline" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Toma de Pedido Rápida</h1>
        <p className="text-slate-500">Selecciona una mesa disponible para comenzar</p>
      </div>

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
              onClick={() => abrirMesaRapido(mesa.id, mesa.numero)}
              className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-center hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <Utensils size={24} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-800 text-lg">{mesa.numero}</p>
                  <p className="text-xs text-slate-400">{mesa.zona} • Capacidad: {mesa.capacidad}</p>
                </div>
              </div>
              <ArrowRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}