'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Package, DollarSign, ArrowDownCircle } from 'lucide-react';

export default function InventarioReportePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/reportes/inventario');
      if (!res.ok) throw new Error('Respuesta no válida');
      const json = await res.json();
      if (!json?.resumen || !Array.isArray(json?.critico)) {
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

  if (loading) return <div className="p-10 flex justify-center"><span className="animate-pulse font-bold text-slate-400">Escaneando almacén...</span></div>;

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
      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">Merma e Inventario</h1>
        <p className="text-slate-500 font-medium">Control de existencias y valorización de activos</p>
      </div>

      {/* Cards de Estado Crítico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-rose-50 border-2 border-rose-100 p-8 rounded-[2.5rem] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Stock Crítico</p>
            <h3 className="text-4xl font-black text-rose-600">{data.resumen.totalProductosCriticos} <span className="text-lg">Items</span></h3>
          </div>
          <AlertTriangle size={40} className="text-rose-300" />
        </div>

        <div className="bg-white border-2 border-slate-100 p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor en Bodega</p>
            <h3 className="text-3xl font-black text-slate-800">S/ {data.resumen.valorizacionBodega}</h3>
          </div>
          <DollarSign size={40} className="text-slate-200" />
        </div>

        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Estado General</p>
            <h3 className="text-2xl font-black italic">
                {data.resumen.totalProductosCriticos > 5 ? 'REABASTECER' : 'ÓPTIMO'}
            </h3>
          </div>
          <Package size={40} className="opacity-30" />
        </div>
      </div>

      {/* Lista de Productos por Agotarse */}
      <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ArrowDownCircle className="text-rose-500" /> Lista de Reposición Urgente
            </h2>
        </div>
        <table className="w-full text-left">
            <thead className="bg-white">
                <tr className="text-[10px] uppercase font-black text-slate-400 border-b">
                    <th className="p-6">Producto</th>
                    <th className="p-6">Categoría</th>
                    <th className="p-6 text-center">Stock Actual</th>
                    <th className="p-6">Nivel de Alerta</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {data.critico.map((p: any) => (
                    <tr key={p.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="p-6">
                            <p className="font-bold text-slate-700">{p.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono italic">ID: {p.id}</p>
                        </td>
                        <td className="p-6">
                            <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-bold">
                                {p.categoria?.nombre || 'General'}
                            </span>
                        </td>
                        <td className="p-6 text-center font-black text-rose-600 text-xl">
                            {p.stock}
                        </td>
                        <td className="p-6">
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-rose-500 h-full" 
                                    style={{ width: `${(p.stock / 10) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-[9px] font-bold text-rose-400 mt-1 uppercase">Crítico: Menos de 10 unidades</p>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}