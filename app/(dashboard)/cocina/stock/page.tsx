'use client';
import { useEffect, useState } from 'react';
import { Package, Check, X, Search, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function InventarioRapidoPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  const fetchInventario = async () => {
    const res = await fetch('/api/cocina/inventario');
    const data = await res.json();
    setProductos(data);
    setLoading(false);
  };

  useEffect(() => { fetchInventario(); }, []);

  const toggleEstado = async (id: number, nombre: string, estadoActual: boolean) => {
    const nuevoEstado = !estadoActual;
    
    // Actualización optimista (cambiamos en UI antes que en DB para velocidad)
    setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: nuevoEstado } : p));

    try {
      const res = await fetch('/api/cocina/inventario', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo: nuevoEstado })
      });

      if (!res.ok) throw new Error();
      
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });

      Toast.fire({
        icon: 'success',
        title: `${nombre} ahora está ${nuevoEstado ? 'Disponible' : 'AGOTADO'}`
      });
    } catch (err) {
      // Si falla, revertimos el cambio en la UI
      setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: estadoActual } : p));
      Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
    }
  };

  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.categoria.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Inventario de Producción</h1>
        <p className="text-slate-500">Gestiona la disponibilidad de platos y bebidas para el salón</p>
      </div>

      {/* Buscador Rápido */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-3 text-slate-400" size={20} />
        <input 
          type="text"
          placeholder="Buscar plato o categoría..."
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

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
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
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
    </div>
  );
}