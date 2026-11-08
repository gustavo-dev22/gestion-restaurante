'use client';
import { useEffect, useState } from 'react';
import { 
  Plus, Edit, Trash2, Package, Loader2, Search, AlertCircle 
} from 'lucide-react';
import * as Icons from 'lucide-react'; 
import Swal from 'sweetalert2';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, DataTablePagination } from '@/components/ui/DataTable';

interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  categoriaId: number;
  categoria: { nombre: string, icono: string | null };
  imagen_url: string | null;
  activo: boolean;
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchCategorias = async () => {
    const res = await fetch('/api/categorias');
    const data = await res.json();
    if (Array.isArray(data)) setCategorias(data);
  };

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();
      if (Array.isArray(data)) setProductos(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
  }, []);

  // Resetear paginación al buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [filtro]);

  // Lógica de búsqueda y paginación
  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.categoria?.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = productosFiltrados.slice(indexOfFirstItem, indexOfLastItem);

  const confirmarAccion = async (titulo: string, texto: string) => {
    const result = await Swal.fire({
      title: titulo,
      text: texto,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, proceder',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false
    });
    return result.isConfirmed;
  };

  const handleAgregar = async () => {
    const opcionesCats = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    const { value: formValues } = await Swal.fire({
      title: '<span style="font-weight:700;">Nuevo Producto</span>',
      html: `
        <div style="text-align: left; padding: 10px 15px;">
          <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Nombre</label>
          <input id="p-nombre" class="swal2-input" style="width:100%; margin:5px 0 15px 0;">
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600;">Precio (S/)</label>
              <input id="p-precio" type="number" step="0.10" class="swal2-input" style="width:100%; margin:5px 0;">
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600;">Categoría</label>
              <select id="p-categoria" class="swal2-input" style="width:100%; margin:5px 0;">${opcionesCats}</select>
            </div>
          </div>

          <label style="display:block; font-size:13px; font-weight:600;">Descripción</label>
          <textarea id="p-desc" class="swal2-textarea" style="width:100%; margin:5px 0 15px 0; height:70px; resize:none;"></textarea>

          <label style="display:block; font-size:13px; font-weight:600;">URL Imagen</label>
          <input id="p-imagen" class="swal2-input" style="width:100%; margin:5px 0 15px 0;" placeholder="https://...">

          <label style="display:block; font-size:13px; font-weight:600;">Stock Inicial</label>
          <input id="p-stock" type="number" class="swal2-input" style="width:100%; margin:5px 0;" value="0">
        </div>
      `,
      width: '550px',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false,
      preConfirm: () => {
        const nombre = (document.getElementById('p-nombre') as HTMLInputElement).value;
        const precio = (document.getElementById('p-precio') as HTMLInputElement).value;
        const cat = (document.getElementById('p-categoria') as HTMLSelectElement).value;
        if (!nombre || !precio || !cat) return Swal.showValidationMessage('Campos obligatorios');
        return {
          nombre, precio, categoriaId: cat, 
          descripcion: (document.getElementById('p-desc') as HTMLTextAreaElement).value,
          imagen_url: (document.getElementById('p-imagen') as HTMLInputElement).value,
          stock: (document.getElementById('p-stock') as HTMLInputElement).value
        }
      }
    });

    if (formValues && await confirmarAccion('¿Guardar?', `Registrar ${formValues.nombre}`)) {
      const res = await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      if (res.ok) { fetchProductos(); Swal.fire('Éxito', 'Guardado', 'success'); }
    }
  };

  const handleEditar = async (prod: Producto) => {
    const opcionesCats = categorias.map(c => 
      `<option value="${c.id}" ${c.id === prod.categoriaId ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

    const { value: formValues } = await Swal.fire({
      title: '<span style="font-weight:700;">Editar Producto</span>',
      html: `
        <div style="text-align: left; padding: 10px 15px;">
          <div style="display:flex; justify-content:center; margin-bottom:15px;">
            <img src="${prod.imagen_url || 'https://via.placeholder.com/100'}" 
                 style="width:100px; height:100px; object-fit:cover; border-radius:12px; border: 2px solid #e2e8f0; shadow: sm;">
          </div>

          <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Nombre del Producto</label>
          <input id="p-nombre" class="swal2-input" style="width:100%; margin:5px 0 15px 0;" value="${prod.nombre}">
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Precio (S/)</label>
              <input id="p-precio" type="number" step="0.10" class="swal2-input" style="width:100%; margin:5px 0;" value="${prod.precio}">
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Categoría</label>
              <select id="p-categoria" class="swal2-input" style="width:100%; margin:5px 0;">${opcionesCats}</select>
            </div>
          </div>

          <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Descripción</label>
          <textarea id="p-desc" class="swal2-textarea" style="width:100%; margin:5px 0 15px 0; height:70px; resize:none;">${prod.descripcion || ''}</textarea>

          <label style="display:block; font-size:13px; font-weight:600; color:#475569;">URL Imagen</label>
          <input id="p-imagen" class="swal2-input" style="width:100%; margin:5px 0 15px 0;" value="${prod.imagen_url || ''}" placeholder="https://...">

          <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Stock Actual</label>
          <input id="p-stock" type="number" class="swal2-input" style="width:100%; margin:5px 0;" value="${prod.stock}">
        </div>
      `,
      width: '550px',
      showCancelButton: true,
      confirmButtonText: 'Actualizar Cambios',
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false,
      preConfirm: () => {
        const nombre = (document.getElementById('p-nombre') as HTMLInputElement).value;
        const precio = (document.getElementById('p-precio') as HTMLInputElement).value;
        const cat = (document.getElementById('p-categoria') as HTMLSelectElement).value;
        
        if (!nombre || !precio || !cat) return Swal.showValidationMessage('Campos obligatorios');
        
        return {
          id: prod.id,
          nombre,
          precio,
          categoriaId: cat,
          descripcion: (document.getElementById('p-desc') as HTMLTextAreaElement).value,
          imagen_url: (document.getElementById('p-imagen') as HTMLInputElement).value,
          stock: (document.getElementById('p-stock') as HTMLInputElement).value
        }
      }
    });

    if (formValues && await confirmarAccion('¿Actualizar?', 'Se aplicarán los cambios en la base de datos')) {
      const res = await fetch('/api/productos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      if (res.ok) { 
        fetchProductos(); 
        Swal.fire('Listo', 'Producto actualizado correctamente', 'success'); 
      } else {
        Swal.fire('Error', 'No se pudo actualizar el producto', 'error');
      }
    }
  };

  const handleEliminar = async (id: number, nombre: string) => {
    if (await confirmarAccion('¿Eliminar?', `Quitar ${nombre} de la carta`)) {
      const res = await fetch(`/api/productos?id=${id}`, { method: 'DELETE' });
      if (res.ok) { fetchProductos(); Swal.fire('Eliminado', '', 'success'); }
    }
  };

  const DynamicIcon = ({ name }: { name: string | null }) => {
    const IconComponent = (Icons as any)[name || 'Tag'] || Icons.Tag;
    return <IconComponent size={16} />;
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Productos"
        description="Control de platos e inventario"
        actions={
          <Button onClick={handleAgregar}>
            <Plus size={18} /> Nuevo Producto
          </Button>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <Input
          type="text"
          placeholder="Buscar por nombre o categoría..."
          className="pl-10"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <DataTable>
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Producto</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Categoría</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Precio</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Stock</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" /> Cargando...</td></tr>
            ) : currentItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center text-slate-400">
                    <AlertCircle size={40} className="mb-2 opacity-20" />
                    <p className="font-medium text-lg">No se encontraron resultados</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentItems.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {prod.imagen_url ? (
                        <img src={prod.imagen_url} className="w-10 h-10 rounded-lg object-cover border" alt="" />
                      ) : (
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Package size={18} /></div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-700">{prod.nombre}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[150px]">{prod.descripcion}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold w-fit">
                      <DynamicIcon name={prod.categoria?.icono} />
                      {prod.categoria?.nombre}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">S/ {Number(prod.precio).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${prod.stock < 10 ? 'text-red-500' : 'text-slate-600'}`}>
                      {prod.stock} uds.
                    </span>
                  </td>
                  <td className="px-6 py-4 flex justify-center gap-2">
                    <button onClick={() => handleEditar(prod)} className="p-2 text-slate-400 hover:text-blue-600 transition"><Edit size={18} /></button>
                    <button onClick={() => handleEliminar(prod.id, prod.nombre)} className="p-2 text-slate-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>

        {productosFiltrados.length > 0 && (
          <DataTablePagination
            page={currentPage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((p) => p - 1)}
            onNext={() => setCurrentPage((p) => p + 1)}
            info={<span className="text-slate-500">Página {currentPage} de {totalPages}</span>}
          />
        )}
      </div>
    </div>
  );
}