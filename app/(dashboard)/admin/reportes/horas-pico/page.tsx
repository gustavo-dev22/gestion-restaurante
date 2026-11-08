'use client';
import { useEffect, useState } from 'react';
import { Clock, TrendingUp, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { http } from '@/lib/http';

export default function HorasPicoPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const json = await http.get<any>('/api/admin/reportes/horas-pico');
      if (!json?.resumen || !Array.isArray(json?.ventasPorHora)) {
        throw new Error('Datos incompletos');
      }
      setData(json);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="p-10 flex justify-center"><span className="animate-pulse font-bold text-slate-600">Analizando tráfico...</span></div>;

  if (error || !data) {
    return (
      <div className="p-10 flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold text-slate-700">No se pudo cargar el reporte</p>
        <p className="text-slate-500">Intenta nuevamente en unos segundos.</p>
        <button onClick={fetchData} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Reporte de Horas Pico"
        description="Análisis de flujo de clientes por franja horaria"
      />

      {/* Cards de Resumen Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-blue-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-blue-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase opacity-80 mb-1">Hora de Mayor Demanda</p>
            <h3 className="text-4xl font-black italic">{data.resumen.horaMasFrecuente}</h3>
          </div>
          <Clock size={48} className="opacity-30" />
        </div>
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase opacity-80 mb-1">Pico de Pedidos</p>
            <h3 className="text-4xl font-black italic">{data.resumen.maxPedidos} Pedidos</h3>
          </div>
          <Users size={48} className="opacity-30" />
        </div>
      </div>

      {/* Gráfico de Barras Simple */}
      <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" /> Histograma de Ventas (24h)
        </h2>
        
        <div className="flex items-end justify-between h-64 gap-1">
          {data.ventasPorHora.map((v: any, i: number) => {
            const max = data.resumen.maxPedidos || 1; // Evitar división por cero
            const altura = (v.cantidad / max) * 100;
            
            return (
                <div key={i} className="flex-1 flex flex-col items-center group relative h-full">
                {/* Tooltip mejorado */}
                <div className="absolute -top-10 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap">
                    {v.cantidad} pedidos
                </div>
                
                {/* Contenedor de la barra para que siempre ocupe espacio */}
                <div className="w-full flex items-end justify-center h-full px-[1px]">
                    <div 
                    style={{ height: v.cantidad > 0 ? `${Math.max(altura, 5)}%` : '2px' }} 
                    className={`w-full rounded-t-sm transition-all duration-700 ${
                        v.cantidad > 0 
                        ? (v.hora === data.resumen.horaMasFrecuente ? 'bg-blue-600' : 'bg-blue-300') 
                        : 'bg-slate-100'
                    }`}
                    ></div>
                </div>
                
                <span className="text-xs text-slate-600 mt-2 font-medium">
                    {i % 3 === 0 ? v.hora : ''}
                </span>
                </div>
            );
           })}
        </div>
      </div>
    </div>
  );
}