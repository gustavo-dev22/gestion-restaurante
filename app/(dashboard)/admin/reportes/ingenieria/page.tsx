'use client';
import { useEffect, useState } from 'react';
import { Star, Zap, Puzzle, Trash2, Info } from 'lucide-react';

export default function IngenieriaMenuPage() {
  const [reporte, setReporte] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/reportes/ingenieria')
      .then(res => res.json())
      .then(data => setReporte(data));
  }, []);

  const getIcon = (cat: string) => {
    switch(cat) {
      case 'ESTRELLA': return <Star className="text-amber-500" />;
      case 'CABALLO': return <Zap className="text-blue-500" />;
      case 'ROMPECABEZAS': return <Puzzle className="text-purple-500" />;
      default: return <Trash2 className="text-slate-400" />;
    }
  };

  const getColor = (cat: string) => {
    switch(cat) {
      case 'ESTRELLA': return 'bg-amber-50 border-amber-200';
      case 'CABALLO': return 'bg-blue-50 border-blue-200';
      case 'ROMPECABEZAS': return 'bg-purple-50 border-purple-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  if (!reporte) return <div className="p-10 text-center font-bold">Analizando rentabilidad...</div>;

  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">Ingeniería de Menú</h1>
        <p className="text-slate-500 font-medium">Análisis de popularidad vs rentabilidad (Matriz Boston)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {['ESTRELLA', 'CABALLO', 'ROMPECABEZAS', 'PERRO'].map(cat => (
          <div key={cat} className={`p-6 rounded-[2rem] border-2 ${getColor(cat)}`}>
            <div className="flex items-center gap-3 mb-2">
              {getIcon(cat)}
              <span className="font-black text-xs uppercase tracking-widest text-slate-700">{cat}S</span>
            </div>
            <p className="text-2xl font-black text-slate-800">
                {reporte.matriz.filter((p:any) => p.clasificacion === cat).length}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">Platos identificados</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b-2 border-slate-100">
            <tr>
              <th className="p-6 text-xs font-black uppercase text-slate-400">Plato</th>
              <th className="p-6 text-xs font-black uppercase text-slate-400 text-center">Ventas (Cant)</th>
              <th className="p-6 text-xs font-black uppercase text-slate-400 text-center">Margen Est.</th>
              <th className="p-6 text-xs font-black uppercase text-slate-400">Clasificación</th>
              <th className="p-6 text-xs font-black uppercase text-slate-400">Acción Sugerida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {reporte.matriz.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-6 font-bold text-slate-700">{p.nombre}</td>
                <td className="p-6 text-center font-mono font-bold text-slate-500">{p.cantidad}</td>
                <td className="p-6 text-center text-emerald-600 font-black">S/ {p.margen}</td>
                <td className="p-6">
                   <div className="flex items-center gap-2">
                     {getIcon(p.clasificacion)}
                     <span className="text-[10px] font-black">{p.clasificacion}</span>
                   </div>
                </td>
                <td className="p-6">
                    <span className="text-[10px] bg-white border border-slate-200 px-3 py-1 rounded-full font-bold text-slate-500">
                        {p.clasificacion === 'ESTRELLA' && "Promocionar más"}
                        {p.clasificacion === 'CABALLO' && "Revisar costos/receta"}
                        {p.clasificacion === 'ROMPECABEZAS' && "Mejorar visibilidad"}
                        {p.clasificacion === 'PERRO' && "Evaluar retiro"}
                    </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}