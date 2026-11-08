'use client';
import { useEffect, useState } from 'react';
import { Medal, TrendingUp, Award } from 'lucide-react';

export default function DesempenoPersonalPage() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRanking = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/reportes/personal');
      if (!res.ok) throw new Error('Respuesta no válida');
      const data = await res.json();
      setRanking(Array.isArray(data) ? data : []);
    } catch {
      setRanking([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRanking();
  }, []);

  if (loading) return <div className="p-10 flex justify-center"><span className="animate-pulse font-bold text-slate-400">Cargando desempeño...</span></div>;

  if (error) {
    return (
      <div className="p-10 flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-bold text-slate-700">No se pudo cargar el reporte</p>
        <p className="text-slate-500">Intenta nuevamente en unos segundos.</p>
        <button onClick={fetchRanking} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold">Reintentar</button>
      </div>
    );
  }

  if (ranking.length === 0) return <div className="p-10 text-center font-bold text-slate-400">Sin datos de ventas aún...</div>;

  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">Desempeño del Personal</h1>
        <p className="text-slate-500 font-medium">Ranking de productividad y eficiencia de ventas</p>
      </div>

      {/* El Top 1 (Ganador) */}
      <div className="bg-gradient-to-r from-amber-400 to-amber-600 p-1 rounded-[3rem] mb-12 shadow-2xl shadow-amber-200">
        <div className="bg-white rounded-[2.8rem] p-8 flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-6">
                <div className="bg-amber-100 p-6 rounded-full">
                    <Medal size={48} className="text-amber-500" />
                </div>
                <div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Mejor Vendedor del Mes</span>
                    <h2 className="text-4xl font-black text-slate-800 italic">{ranking[0].mesero}</h2>
                </div>
            </div>
            <div className="mt-6 md:mt-0 text-right">
                <p className="text-sm font-bold text-slate-400 uppercase">Venta Acumulada</p>
                <p className="text-5xl font-black text-slate-900">S/ {Number(ranking[0].total).toFixed(2)}</p>
            </div>
        </div>
      </div>

      {/* Tabla de Ranking Completa */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Award className="text-blue-600" /> Tabla de Clasificación
                </h3>
            </div>
            <table className="w-full text-left">
                <thead className="bg-slate-50">
                    <tr className="text-[10px] uppercase font-black text-slate-400">
                        <th className="p-6">Pos.</th>
                        <th className="p-6">Mesero</th>
                        <th className="p-6 text-center">Pedidos</th>
                        <th className="p-6 text-right">Total Soles</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {ranking.map((m, idx) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-6 font-black text-slate-300 group-hover:text-blue-600 text-xl italic">#{idx + 1}</td>
                            <td className="p-6 font-bold text-slate-700">{m.mesero}</td>
                            <td className="p-6 text-center font-bold text-slate-500">{m.pedidos}</td>
                            <td className="p-6 text-right font-black text-slate-800">S/ {Number(m.total).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* Resumen de Eficiencia (Ticket Promedio) */}
        <div className="space-y-6">
            <h3 className="font-bold text-slate-800 px-4">Calidad de Venta (Ticket Promedio)</h3>
            {ranking.map((m) => (
                <div key={m.id} className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl"><TrendingUp size={20}/></div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">{m.mesero}</p>
                            <p className="font-black text-slate-800 italic">S/ {m.ticketPromedio}</p>
                        </div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter text-right">
                        Promedio<br/>por mesa
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}