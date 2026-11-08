'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { 
  Clock, Receipt, PlusCircle, ArrowRight, 
  Loader2, Utensils, AlertCircle 
} from 'lucide-react';

export default function MisPedidosPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const usuario = useAuthStore((state) => state.user);

  const fetchPedidosActivos = async () => {
    if (!usuario?.id) return;
    
    setLoading(true);
    try {
      // Enviamos el usuarioId como parámetro
      const res = await fetch(`/api/mesero/pedidos-activos?usuarioId=${usuario.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setPedidos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchPedidosActivos(); 
  }, [usuario?.id]); // Se dispara cuando el usuario carga

  const calcularTiempo = (fecha: string) => {
  try {
    // 1. Convertimos el string de la DB (Hora de Perú) a objeto Date.
    // Al usar replace(" ", "T"), JS lo interpreta como hora local del navegador.
    const fechaISO = fecha.replace(" ", "T");
    const inicio = new Date(fechaISO);
    const ahora = new Date();

    // 2. Calculamos la diferencia bruta en milisegundos
    const diffMs = ahora.getTime() - inicio.getTime();
    
    // 3. Convertimos a minutos totales
    let totalMinutos = Math.floor(diffMs / 60000);

    // 4. EL AJUSTE CLAVE:
    // Si la diferencia es mayor a 300 minutos (5 horas), es probable que JS
    // esté comparando una fecha "Local" contra una "UTC".
    // Si el contador te daba 300 min de más, restamos 300. 
    // Si te daba 300 de menos (números negativos), sumamos 300.
    // Basado en tus casos, JS está interpretando la fecha de la DB con 5 horas de adelanto.
    if (totalMinutos >= 300) {
      totalMinutos -= 300; 
    } else if (totalMinutos < 0) {
      totalMinutos += 300;
    }

    // Seguridad para errores de casteo
    if (isNaN(totalMinutos)) return "...";
    if (totalMinutos <= 0) return "1 min";
    
    // 5. Formateo de salida (Soporta días si es necesario)
    if (totalMinutos >= 60) {
      const horas = Math.floor(totalMinutos / 60);
      const mins = totalMinutos % 60;
      
      if (horas >= 24) {
        const dias = Math.floor(horas / 24);
        const horasRestantes = horas % 24;
        return `${dias}d ${horasRestantes}h ${mins}m`;
      }
      
      return `${horas}h ${mins}m`;
    }
    
    return `${totalMinutos} min`;
  } catch (e) {
    console.error("Error calculando tiempo:", e);
    return "...";
  }
};

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mis Pedidos Activos</h1>
          <p className="text-slate-500 text-sm">Seguimiento de mesas en servicio</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-bold text-sm">
          {pedidos.length} Mesas atendiendo
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pedidos.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <Utensils className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">No tienes pedidos abiertos en este momento.</p>
            <button 
              onClick={() => router.push('/mesero/salon')}
              className="mt-4 text-blue-600 font-bold hover:underline"
            >
              Ir al salón para abrir una mesa
            </button>
          </div>
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
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <Clock size={12} /> {calcularTiempo(p.fecha_creacion)}
                  </div>
                  <p className="text-slate-500 text-sm">{p.detalles.length} platos en comanda</p>
                </div>
              </div>

              {/* Monto Acumulado */}
              <div className="text-center md:text-right mb-4 md:mb-0">
                <p className="text-xs font-bold text-slate-400 uppercase">Total actual</p>
                <p className="text-2xl font-black text-slate-800">S/ {Number(p.total).toFixed(2)}</p>
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