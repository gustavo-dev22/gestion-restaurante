'use client';
import { useCallback, useEffect, useState } from 'react';
import { Clock, CheckCircle2, Flame, Utensils, Loader2 } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toastSuccess, toastError } from '@/components/ui/Toast';

export default function ComandasCocinaPage() {
  const [comandas, setComandas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaActual, setAreaActual] = useState('Cocina');
  const [isFading, setIsFading] = useState(false);
  const [pendiente, setPendiente] = useState<{ id: number; nombre: string } | null>(null);
  const [completando, setCompletando] = useState(false);

  const fetchComandas = useCallback(async (silent = false) => {
    if (!silent) {
      setIsFading(true);
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/cocina/comandas?area=${areaActual}`);
      const data = await res.json();
      setComandas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al filtrar:", error);
    } finally {
      if (!silent) {
        setLoading(false);
        setIsFading(false);
      }
    }
  }, [areaActual]);

  useEffect(() => {
    fetchComandas();
    // Refresco silencioso cada 30 segundos (sin spinner a pantalla completa)
    const interval = setInterval(() => fetchComandas(true), 30000);
    return () => clearInterval(interval);
  }, [fetchComandas]);

  // Tiempo transcurrido real desde la creación del pedido
  const formatTiempoTranscurrido = (fecha: string | null | undefined) => {
    if (!fecha) return '—';
    const inicio = new Date(fecha);
    if (isNaN(inicio.getTime())) return '—';

    // La fecha de la BD no incluye zona horaria; ajustamos al huso del navegador
    let minutos = Math.floor((Date.now() - inicio.getTime()) / 60000) - new Date().getTimezoneOffset();
    if (minutos < 0) minutos = 0;

    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    if (horas >= 24) {
      const dias = Math.floor(horas / 24);
      const horasRestantes = horas % 24;
      return `${dias}d ${horasRestantes}h ${mins}m`;
    }
    return `${horas}h ${mins}m`;
  };

  const getLabelPendientes = (area: string, cantidad: number) => {
    const n = area.toLowerCase();
    let label = 'item';

    if (n === 'cocina') label = cantidad === 1 ? 'plato' : 'platos';
    else if (n === 'bar') label = cantidad === 1 ? 'bebida' : 'bebidas';
    else if (n === 'postres') label = cantidad === 1 ? 'postre' : 'postres';

    return `${cantidad} ${label}`;
  };

  const completarPlato = async () => {
    if (!pendiente) return;
    setCompletando(true);
    try {
      const res = await fetch('/api/cocina/comandas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detalleId: pendiente.id,
          nuevoEstado: 'Listo',
        }),
      });

      if (!res.ok) throw new Error();

      setComandas((prev) => prev.filter((comanda) => comanda.id !== pendiente.id));
      toastSuccess(
        areaActual === 'Bebidas' ? 'Bebida despachada' : 'Plato despachado',
        pendiente.nombre
      );
      setPendiente(null);
    } catch {
      toastError('No se pudo actualizar', 'Intenta nuevamente en unos segundos.');
    } finally {
      setCompletando(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <Flame className="text-orange-500" /> MONITOR DE COCINA
          </h1>
          <p className="text-slate-400">Pedidos activos en tiempo real</p>
        </div>
        <div className="bg-slate-800 px-6 py-3 rounded-2xl border border-slate-700 transition-all duration-300">
          <span className="text-sm font-bold text-slate-500 block uppercase tracking-tighter">
            Pendientes en {areaActual}
          </span>
          <span className="text-2xl font-black text-orange-400">
            {getLabelPendientes(areaActual, comandas.length)}
          </span>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setAreaActual('Cocina')}
          className={`px-6 py-2 rounded-xl font-bold ${areaActual === 'Cocina' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          🍳 COCINA
        </button>
        <button 
          onClick={() => setAreaActual('Bebidas')}
          className={`px-6 py-2 rounded-xl font-bold ${areaActual === 'Bebidas' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          🍹 BAR / BEBIDAS
        </button>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-all duration-500 transform ${
  isFading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
}`}>
        {comandas.map((comanda) => (
          <div 
            key={comanda.id}
            className="bg-white text-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col border-t-8 border-t-orange-500"
          >
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-4">
                <span className="bg-slate-100 px-3 py-1 rounded-lg font-black text-lg">
                  Mesa {comanda.pedido.mesa.numero}
                </span>
                <div className="flex items-center gap-1 text-slate-400 text-xs font-bold">
                  <Clock size={14} /> {formatTiempoTranscurrido(comanda.pedido?.fecha_creacion)}
                </div>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-black block">{comanda.cantidad}x</span>
                <h3 className="text-xl font-bold leading-tight">{comanda.producto.nombre}</h3>
                <p className="text-slate-500 text-sm mt-1 italic">
                  {comanda.producto.descripcion || 'Sin notas especiales'}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setPendiente({ id: comanda.id, nombre: comanda.producto.nombre })}
              className={`w-full py-4 font-bold flex items-center justify-center gap-2 transition-all ${
                areaActual === 'Bar' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'
              } text-white`}
            >
              <CheckCircle2 size={20} /> 
              {areaActual === 'Bebidas' ? 'BEBIDA LISTA' : 'PLATO TERMINADO'}
            </button>
          </div>
        ))}
      </div>

      {comandas.length === 0 && (
        <div className="text-center py-20 opacity-40">
          <Utensils size={80} className="mx-auto mb-4" />
          <p className="text-2xl font-bold">¡Cocina limpia! Sin pendientes.</p>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendiente)}
        onClose={() => setPendiente(null)}
        onConfirm={completarPlato}
        title={
          areaActual === "Bebidas"
            ? "¿Bebida lista?"
            : areaActual === "Postres"
              ? "¿Postre listo?"
              : "¿Plato terminado?"
        }
        description={pendiente ? `Confirmar que "${pendiente.nombre}" ya salió de la estación de ${areaActual}.` : undefined}
        confirmLabel="Sí, listo"
        cancelLabel="No, esperar"
        variant="success"
        loading={completando}
      />
    </div>
  );
}