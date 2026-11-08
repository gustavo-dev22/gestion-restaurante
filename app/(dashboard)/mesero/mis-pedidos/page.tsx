'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Clock, Receipt, PlusCircle, Utensils } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { timeAgo, formatCurrency } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { http } from '@/lib/http';

interface PedidoActivo {
  id: number;
  total: number | string;
  fecha_creacion: string;
  mesa: { numero: string };
  detalles: unknown[];
}
export default function MisPedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoActivo[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const usuario = useAuthStore((state) => state.user);

  const fetchPedidosActivos = useCallback(async () => {
    if (!usuario?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await http.get<PedidoActivo[]>(`/api/mesero/pedidos-activos?usuarioId=${usuario.id}`);
      if (Array.isArray(data)) setPedidos(data);
    } catch {
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [usuario?.id]);

  useEffect(() => {
    fetchPedidosActivos();
  }, [fetchPedidosActivos]);

  if (loading) return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <TableSkeleton rows={3} columns={4} />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Mis Pedidos Activos"
        description="Seguimiento de mesas en servicio"
        actions={
          <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            {pedidos.length} Mesas atendiendo
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        {pedidos.length === 0 ? (
          <EmptyState
            icon={Utensils}
            title="Sin pedidos abiertos"
            description="No tienes pedidos abiertos en este momento."
            action={
              <button
                type="button"
                onClick={() => router.push('/mesero/salon')}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Ir al salón para abrir una mesa
              </button>
            }
          />
        ) : (
          pedidos.map((p) => (
            <div 
              key={p.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center hover:shadow-lg transition-all border-l-4 border-l-blue-500"
            >
              {/* Info Mesa y Tiempo */}
              <div className="flex items-center gap-4 w-full md:w-auto mb-4 md:mb-0">
                <div className="bg-slate-100 p-4 rounded-xl text-slate-700">
                  <span className="text-xl font-black">{p.mesa.numero}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-600 text-xs font-bold uppercase tracking-wider">
                    <Clock size={12} /> {timeAgo(p.fecha_creacion)}
                  </div>
                  <p className="text-slate-500 text-sm">{p.detalles.length} platos en comanda</p>
                </div>
              </div>

              {/* Monto Acumulado */}
              <div className="text-center md:text-right mb-4 md:mb-0">
                <p className="text-xs font-bold text-slate-600 uppercase">Total actual</p>
                <p className="text-2xl font-black text-slate-800">{formatCurrency(p.total)}</p>
              </div>

              {/* Acciones Rápidas */}
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => router.push(`/mesero/pedido/${p.id}`)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
                >
                  <PlusCircle size={18} /> Comanda
                </button>
                <button 
                  onClick={() => router.push(`/mesero/pedido/resumen/${p.id}`)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  <Receipt size={18} /> Cuenta
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}