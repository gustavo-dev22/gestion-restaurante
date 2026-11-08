'use client';
import { useEffect, useState } from 'react';
import { 
  Package, Layers, LayoutGrid, AlertTriangle, 
  CheckCircle, Users, ArrowRight, Loader2 
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Panel de Administración</h1>
        <p className="text-slate-500">Resumen general de tu restaurante</p>
      </div>

      {/* Grid de Tarjetas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Productos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Package size={24} />
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Carta</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.productos}</h3>
          <p className="text-slate-500 text-sm">Productos Activos</p>
        </div>

        {/* Categorías */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Layers size={24} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.categorias}</h3>
          <p className="text-slate-500 text-sm">Categorías</p>
        </div>

        {/* Mesas Libres */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Salón</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.mesasLibres} / {stats.mesasTotal}</h3>
          <p className="text-slate-500 text-sm">Mesas Disponibles</p>
        </div>

        {/* Alerta Stock */}
        <div className={`${stats.stockBajo > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100'} p-6 rounded-2xl shadow-sm border transition-colors`}>
          <div className={`flex justify-between items-start mb-4 ${stats.stockBajo > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
            <div className={`p-3 rounded-xl ${stats.stockBajo > 0 ? 'bg-orange-100' : 'bg-slate-50'}`}>
              <AlertTriangle size={24} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.stockBajo}</h3>
          <p className="text-slate-500 text-sm">Productos con Stock Bajo</p>
        </div>
      </div>

      {/* Sección de Estado del Salón y Accesos Rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Resumen de Mesas */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Estado del Salón</h2>
          <div className="flex items-center gap-8">
             <div className="relative size-32">
                {/* Un gráfico simple con CSS para representar ocupación */}
                <div className="size-full rounded-full border-[12px] border-slate-100 flex items-center justify-center text-center">
                   <div>
                     <p className="text-2xl font-bold text-slate-800">{Math.round((stats.mesasOcupadas / stats.mesasTotal) * 100) || 0}%</p>
                     <p className="text-[10px] uppercase text-slate-400 font-bold">Ocupado</p>
                   </div>
                </div>
             </div>
             <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                   <div className="flex items-center gap-3">
                      <div className="size-3 rounded-full bg-emerald-500"></div>
                      <span className="text-sm font-medium text-slate-600">Mesas Libres</span>
                   </div>
                   <span className="font-bold text-slate-800">{stats.mesasLibres}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                   <div className="flex items-center gap-3">
                      <div className="size-3 rounded-full bg-rose-500"></div>
                      <span className="text-sm font-medium text-slate-600">Mesas Ocupadas</span>
                   </div>
                   <span className="font-bold text-slate-800">{stats.mesasOcupadas}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="space-y-4">
           <h2 className="text-lg font-bold text-slate-800 px-2">Acciones Rápidas</h2>
           <Link href="/admin/productos" className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Package size={20} />
                </div>
                <span className="font-semibold text-slate-700">Gestionar Carta</span>
              </div>
              <ArrowRight size={18} className="text-slate-300" />
           </Link>

           <Link href="/admin/mesas" className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <LayoutGrid size={20} />
                </div>
                <span className="font-semibold text-slate-700">Control de Mesas</span>
              </div>
              <ArrowRight size={18} className="text-slate-300" />
           </Link>
        </div>
      </div>
    </div>
  );
}