'use client';
import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, Flame, Utensils, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ComandasCocinaPage() {
  const [comandas, setComandas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaActual, setAreaActual] = useState('Cocina');
  const [isFading, setIsFading] = useState(false);

  const fetchComandas = async () => {
    setIsFading(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/cocina/comandas?area=${areaActual}`);
      const data = await res.json();
      
      setTimeout(() => {
        setComandas(data);
        setLoading(false);
        setIsFading(false); // Iniciamos animación de entrada
      }, 200); // Pequeño delay para que la vista respire
    } catch (error) {
      console.error("Error al filtrar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComandas();
    // Opcional: Refresco automático cada 30 segundos
    const interval = setInterval(fetchComandas, 30000);
    return () => clearInterval(interval);
  }, [areaActual]);

  const getLabelPendientes = (area: string, cantidad: number) => {
    const n = area.toLowerCase();
    let label = 'item';

    if (n === 'cocina') label = cantidad === 1 ? 'plato' : 'platos';
    else if (n === 'bar') label = cantidad === 1 ? 'bebida' : 'bebidas';
    else if (n === 'postres') label = cantidad === 1 ? 'postre' : 'postres';

    return `${cantidad} ${label}`;
  };

  const getTerminoConfirmacion = (area: string) => {
    const n = area.toLowerCase();
    if (n === 'bebidas') return '¿Bebida lista?';
    if (n === 'postres') return '¿Postre listo?';
    return '¿Plato terminado?'; // Default para cocina
  };

  const completarPlato = async (detalleId: number, nombre: string) => {
    const tituloConfirmacion = getTerminoConfirmacion(areaActual);
    const result = await Swal.fire({
        title: tituloConfirmacion,
        text: `Confirmar que "${nombre}" ya salió de la estación de ${areaActual}.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '¡Listo!',
        cancelButtonText: 'No, esperar',
        confirmButtonColor: areaActual === 'Bebidas' ? '#3b82f6' : '#10b981',
        allowEscapeKey: false,
        allowOutsideClick: false
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Actualizando...', didOpen: () => Swal.showLoading() });

        const res = await fetch('/api/cocina/comandas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            detalleId: detalleId, 
            nuevoEstado: 'Listo' 
        })
        });

        if (res.ok) {
          // Quitamos el plato de la lista localmente
          setComandas(prev => prev.filter(c => c.id !== detalleId));
          // Notificación rápida de éxito (Toast)
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
          });

          Toast.fire({
            icon: 'success',
            title: areaActual === 'Bar' ? 'Bebida despachada' : 'Plato despachado'
          });
        }
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
                  <Clock size={14} /> 10 min
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
              onClick={() => completarPlato(comanda.id, comanda.producto.nombre)}
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
        <div className="text-center py-20 opacity-20">
          <Utensils size={80} className="mx-auto mb-4" />
          <p className="text-2xl font-bold">¡Cocina limpia! Sin pendientes.</p>
        </div>
      )}
    </div>
  );
}