'use client';
import { useEffect, useState } from 'react';
import { Clock, TrendingUp, Users, ArrowUpRight } from 'lucide-react';

export default function HorasPicoPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/reportes/horas-pico')
      .then(res => res.json())
      .then(json => setData(json));
  }, []);

  if (!data) return <div className="p-10 text-center font-bold">Analizando tráfico de red...</div>;

  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">Reporte de Horas Pico</h1>
        <p className="text-slate-500 font-medium">Análisis de flujo de clientes por franja horaria</p>
      </div>

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
                <div className="absolute -top-10 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg z-20 whitespace-nowrap">
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
                
                <span className="text-[8px] text-slate-400 mt-2 font-medium">
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