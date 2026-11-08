'use client';
import { useEffect, useState } from 'react';
import { Package, Search, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { http } from '@/lib/http';

interface ProductoStock {
  id: number;
  nombre: string;
  activo: boolean;
  categoria: { nombre: string };
}
export default function InventarioRapidoPage() {
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  const fetchInventario = async () => {
    try {
      const data = await http.get<ProductoStock[]>('/api/cocina/inventario');
      setProductos(Array.isArray(data) ? data : []);
    } catch {
      setProductos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInventario(); }, []);

  const toggleEstado = async (id: number, nombre: string, estadoActual: boolean) => {
    const nuevoEstado = !estadoActual;
    
    // Actualización optimista (cambiamos en UI antes que en DB para velocidad)
    setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: nuevoEstado } : p));

    try {
      await http.patch('/api/cocina/inventario', { id, activo: nuevoEstado });

      toastSuccess(
        `${nombre} ${nuevoEstado ? "disponible" : "agotado"}`,
        nuevoEstado ? "El producto ya puede pedirse." : "El producto se marcó como agotado."
      );
    } catch {
      // Si falla, revertimos el cambio en la UI
      setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: estadoActual } : p));
      toastError("No se pudo actualizar el estado", "Intenta nuevamente en unos segundos.");
    }
  };

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.categoria.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="p-6">
      <PageHeader
        title="Inventario de Producción"
        description="Gestiona la disponibilidad de platos y bebidas para el salón"
      />

      {/* Buscador Rápido */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
        <Input
          type="text"
          placeholder="Buscar plato o categoría..."
          className="pl-10"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      {productosFiltrados.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin productos"
          description="No se encontraron platos o bebidas con ese criterio de búsqueda."
        />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {productosFiltrados.map((prod) => (
          <div 
            key={prod.id}
            className={`p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${
              prod.activo ? 'bg-white border-slate-100 shadow-sm' : 'bg-rose-50 border-rose-100'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${prod.activo ? 'bg-blue-50 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                <Package size={24} />
              </div>
              <div>
                <h3 className={`font-bold ${prod.activo ? 'text-slate-800' : 'text-rose-900'}`}>{prod.nombre}</h3>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                  {prod.categoria.nombre}
                </span>
              </div>
            </div>

            <button 
              onClick={() => toggleEstado(prod.id, prod.nombre, prod.activo)}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                prod.activo 
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}
            >
              {prod.activo ? 'DISPONIBLE' : 'AGOTADO'}
            </button>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}