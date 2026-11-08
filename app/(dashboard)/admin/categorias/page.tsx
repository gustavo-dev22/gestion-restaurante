'use client';
import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react'; // Importamos todos los iconos
import Swal from 'sweetalert2';

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  area: string;
  activo: boolean;
  fecha_creacion: string;
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/categorias');
      const data = await res.json();
      if (Array.isArray(data)) setCategorias(data);
    } catch (error) {
      setCategorias([]);
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = categorias.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(categorias.length / itemsPerPage);

  // Función para renderizar icono dinámico
  const DynamicIcon = ({ name }: { name: string | null }) => {
    const IconComponent = (Icons as any)[name || 'Tag'] || Icons.Tag;
    return <IconComponent size={16} />;
  };

  // Función genérica para confirmar acción
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
      allowEscapeKey: false,
      allowOutsideClick: false
    });
    return result.isConfirmed;
  };

  const handleAgregar = async () => {
    const { value: formValues } = await Swal.fire({
      title: '<span style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">Nueva Categoría</span>',
      html: `
        <div style="text-align: left; padding: 10px 15px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Nombre de la Categoría</label>
            <input id="swal-nombre" class="swal2-input" style="width: 100%; margin: 0; font-size: 15px; border-radius: 8px;" placeholder="Ej. Bebidas, Fondos...">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Descripción</label>
            <textarea id="swal-descripcion" class="swal2-textarea" style="width: 100%; margin: 0; height: 90px; font-size: 15px; border-radius: 8px; resize: none;" placeholder="Breve detalle de la categoría..."></textarea>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Área de Producción</label>
            <select id="swal-area" class="swal2-input" style="width: 100%; margin: 0; font-size: 15px; border-radius: 8px;">
              <option value="Cocina">🍳 Cocina</option>
              <option value="Bebidas">🍹 Bebidas</option>
              <option value="Postres">🍰 Postres</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: end;">
            <div>
              <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Icono (Lucide)</label>
              <input id="swal-icono" class="swal2-input" style="width: 100%; margin: 0; font-size: 15px; border-radius: 8px;" value="Tag" placeholder="Ej: Pizza, Coffee">
            </div>
            <div style="display: flex; align-items: center; padding-bottom: 12px; cursor: pointer;">
              <input type="checkbox" id="swal-activo" checked style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
              <label for="swal-activo" style="margin-left: 10px; font-size: 14px; color: #475569; cursor: pointer; font-weight: 500;">¿Está Activa?</label>
            </div>
          </div>
        </div>
      `,
      width: '550px',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
      focusConfirm: false,
      allowEscapeKey: false,
      allowOutsideClick: false,
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value;
        if (!nombre) return Swal.showValidationMessage('El nombre es obligatorio');
        return {
          nombre,
          descripcion: (document.getElementById('swal-descripcion') as HTMLTextAreaElement).value,
          icono: (document.getElementById('swal-icono') as HTMLInputElement).value,
          area: (document.getElementById('swal-area') as HTMLSelectElement).value,
          activo: (document.getElementById('swal-activo') as HTMLInputElement).checked
        };
      }
    });

    if (formValues) {
      const confirmado = await confirmarAccion('¿Confirmar Registro?', `¿Deseas guardar la categoría "${formValues.nombre}"?`);
      if (confirmado) {
        Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        const res = await fetch('/api/categorias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });
        if (res.ok) {
          Swal.fire({title: '¡Éxito!', text: 'Categoría guardada correctamente', icon: 'success', allowEscapeKey: false, allowOutsideClick: false});
          fetchCategorias();
        }
      }
    }
  };

  const handleEditar = async (cat: Categoria) => {
    const { value: formValues } = await Swal.fire({
      title: '<span style="font-size: 1.5rem; font-weight: 700; color: #1e293b;">Editar Categoría</span>',
      html: `
        <div style="text-align: left; padding: 10px 15px;">
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Nombre</label>
            <input id="swal-nombre" class="swal2-input" style="width: 100%; margin: 0; font-size: 15px; border-radius: 8px;" value="${cat.nombre}">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Descripción</label>
            <textarea id="swal-descripcion" class="swal2-textarea" style="width: 100%; margin: 0; height: 90px; font-size: 15px; border-radius: 8px; resize: none;">${cat.descripcion || ''}</textarea>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Área de Producción</label>
            <select id="swal-area" class="swal2-input" style="width: 100%; margin: 0; font-size: 15px; border-radius: 8px;">
              <option value="Cocina" ${cat.area === 'Cocina' ? 'selected' : ''}>🍳 Cocina</option>
              <option value="Bebidas" ${cat.area === 'Bebidas' ? 'selected' : ''}>🍹 Bebidas</option>
              <option value="Postres" ${cat.area === 'Postres' ? 'selected' : ''}>🍰 Postres</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: end;">
            <div>
              <label style="display: block; font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px;">Icono (Lucide)</label>
              <input id="swal-icono" class="swal2-input" style="width: 100%; margin: 0; font-size: 15px; border-radius: 8px;" value="${cat.icono || 'Tag'}">
            </div>
            <div style="display: flex; align-items: center; padding-bottom: 12px; cursor: pointer;">
              <input type="checkbox" id="swal-activo" ${cat.activo ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #2563eb; cursor: pointer;">
              <label for="swal-activo" style="margin-left: 10px; font-size: 14px; color: #475569; cursor: pointer; font-weight: 500;">¿Activo?</label>
            </div>
          </div>
        </div>
      `,
      width: '550px',
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false,
      preConfirm: () => ({
        id: cat.id,
        nombre: (document.getElementById('swal-nombre') as HTMLInputElement).value,
        descripcion: (document.getElementById('swal-descripcion') as HTMLTextAreaElement).value,
        icono: (document.getElementById('swal-icono') as HTMLInputElement).value,
        area: (document.getElementById('swal-area') as HTMLSelectElement).value,
        activo: (document.getElementById('swal-activo') as HTMLInputElement).checked
      })
    });

    if (formValues) {
      const confirmado = await confirmarAccion('¿Confirmar Cambios?', '¿Deseas actualizar la información de esta categoría?');
      if (confirmado) {
        const res = await fetch('/api/categorias', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formValues),
        });
        if (res.ok) {
          Swal.fire({title: '¡Actualizado!', text: 'Los cambios se guardaron con éxito.', icon: 'success', allowEscapeKey: false, allowOutsideClick: false});
          fetchCategorias();
        }
      }
    }
  };

  const handleEliminar = async (id: number, nombre: string) => {
    const confirmado = await confirmarAccion('¿Desactivar?', `¿Estás seguro de desactivar "${nombre}"?`);
    
    if (confirmado) {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      
      const res = await fetch(`/api/categorias?id=${id}`, { method: 'DELETE' });
      const data = await res.json(); // Ahora data trae { success, message }

      if (data.success) {
        Swal.fire({ title: '¡Éxito!', text: data.message, icon: 'success', allowEscapeKey: false, allowOutsideClick: false });
        fetchCategorias();
      } else {
        // Si success es false, mostramos el mensaje de validación
        Swal.fire({
          title: 'Atención',
          text: data.message,
          icon: 'warning',
          confirmButtonColor: '#2563eb',
          allowEscapeKey: false,
          allowOutsideClick: false
        });
      }
    }
  };

  useEffect(() => { fetchCategorias(); }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Mantenimiento de Categorías</h1>
        <button onClick={handleAgregar} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
          <Plus size={18} /> Nueva Categoría
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center text-slate-400"><Loader2 className="animate-spin mb-2" /> Cargando...</div>
        ) : currentItems.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-slate-400"><AlertCircle className="mb-2" /> Sin registros</div>
        ) : (
          <>
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Area</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">#{cat.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                          <DynamicIcon name={cat.icono} />
                        </div>
                        <span className="font-semibold text-slate-700">{cat.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{cat.descripcion || 'Sin descripción'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        cat.area === 'Bebidas' ? 'bg-blue-100 text-blue-700' : 
                        cat.area === 'Postres' ? 'bg-purple-100 text-purple-700' : 
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {cat.area}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex justify-center gap-2">
                      <button onClick={() => handleEditar(cat)} className="p-2 text-slate-400 hover:text-blue-600 transition"><Edit size={18} /></button>
                      <button onClick={() => handleEliminar(cat.id, cat.nombre)} className="p-2 text-slate-400 hover:text-red-600 transition"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Paginación */}
            <div className="bg-slate-50 px-6 py-3 border-t flex justify-between items-center text-sm text-slate-600">
              <p>Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, categorias.length)} de {categorias.length}</p>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="p-1 rounded border bg-white disabled:opacity-30"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="p-1 rounded border bg-white disabled:opacity-30"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}