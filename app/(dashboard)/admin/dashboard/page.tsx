'use client';
import { useEffect, useState } from 'react';
import { 
  Package, Layers, LayoutGrid, AlertTriangle, 
  CheckCircle, ArrowRight, Loader2, AlertCircle 
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Respuesta no válida');
      const data = await res.json();
      if (!data || typeof data !== 'object') throw new Error('Datos inválidos');
      setStats(data);
    } catch {
      setStats(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="text-rose-500" size={48} />
        <div>
          <h2 className="text-xl font-bold text-slate-800">No se pudo cargar el panel</h2>
          <p className="text-slate-500">Revisa la conexión con el servidor e inténtalo de nuevo.</p>
        </div>
        <button
          onClick={fetchStats}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Panel de Administración"
        description="Resumen general de tu restaurante"
      />

      {/* Grid de Tarjetas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Productos */}
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Package size={24} />
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Carta</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.productos}</h3>
          <p className="text-slate-500 text-sm">Productos Activos</p>
        </Card>

        {/* Categorías */}
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Layers size={24} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.categorias}</h3>
          <p className="text-slate-500 text-sm">Categorías</p>
        </Card>

        {/* Mesas Libres */}
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle size={24} />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Salón</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.mesasLibres} / {stats.mesasTotal}</h3>
          <p className="text-slate-500 text-sm">Mesas Disponibles</p>
        </Card>

        {/* Alerta Stock */}
        <Card className={`${stats.stockBajo > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'} p-6 transition-colors`}>
          <div className={`flex justify-between items-start mb-4 ${stats.stockBajo > 0 ? 'text-orange-600' : 'text-slate-600'}`}>
            <div className={`p-3 rounded-xl ${stats.stockBajo > 0 ? 'bg-orange-100' : 'bg-slate-50'}`}>
              <AlertTriangle size={24} />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.stockBajo}</h3>
          <p className="text-slate-500 text-sm">Productos con Stock Bajo</p>
        </Card>
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
                     <p className="text-xs uppercase text-slate-600 font-bold">Ocupado</p>
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