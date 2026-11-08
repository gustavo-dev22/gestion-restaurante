'use client';
import { useEffect, useState } from 'react';
import { 
  Plus, Edit, Trash2, LayoutGrid, Loader2, 
  Users, MapPin, CheckCircle2, XCircle, Clock, Construction 
} from 'lucide-react';
import Swal from 'sweetalert2';

interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  zona: string;
  estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento';
  activo: boolean;
}

export default function MesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroZona, setFiltroZona] = useState('Todas');

  const fetchMesas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mesas');
      const data = await res.json();
      if (Array.isArray(data)) setMesas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMesas();
  }, []);

  // Obtener zonas únicas para el filtro
  const zonas = ['Todas', ...Array.from(new Set(mesas.map(m => m.zona)))];

  const mesasFiltradas = filtroZona === 'Todas' 
    ? mesas 
    : mesas.filter(m => m.zona === filtroZona);

  const getEstadoEstilo = (estado: string) => {
    switch (estado) {
      case 'Libre': return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle2 size={16}/> };
      case 'Ocupada': return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: <XCircle size={16}/> };
      case 'Reservada': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <Clock size={16}/> };
      default: return { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-600', icon: <Construction size={16}/> };
    }
  };

  const handleAgregar = async () => {
    const { value: formValues } = await Swal.fire({
      title: '<span style="font-weight:700; color:#1e293b;">Configurar Nueva Mesa</span>',
      html: `
        <div style="text-align: left; padding: 10px 15px;">
          <div style="margin-bottom: 16px;">
            <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:4px;">Nombre / Identificador</label>
            <div style="position:relative;">
              <input id="m-numero" class="swal2-input" style="width:100%; margin:0; font-size:15px; padding-left:10px;" placeholder="Ej: Mesa 12 o VIP-1">
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:4px;">Capacidad</label>
              <input id="m-capacidad" type="number" class="swal2-input" style="width:100%; margin:0; font-size:15px;" value="4">
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:4px;">Zona / Ubicación</label>
              <input id="m-zona" class="swal2-input" style="width:100%; margin:0; font-size:15px;" placeholder="Ej: Terraza">
            </div>
          </div>
        </div>
      `,
      width: '500px',
      showCancelButton: true,
      confirmButtonText: 'Guardar Mesa',
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false,
      customClass: {
        confirmButton: 'px-6 py-2 rounded-lg',
        cancelButton: 'px-6 py-2 rounded-lg'
      },
      preConfirm: () => {
        const numero = (document.getElementById('m-numero') as HTMLInputElement).value;
        const capacidad = (document.getElementById('m-capacidad') as HTMLInputElement).value;
        const zona = (document.getElementById('m-zona') as HTMLInputElement).value;
        if (!numero || !zona) return Swal.showValidationMessage('El número y la zona son obligatorios');
        return { numero, capacidad, zona };
      }
    });

    if (formValues) {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading() });
      const res = await fetch('/api/mesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      if (res.ok) { fetchMesas(); Swal.fire({title: '¡Éxito!', text: 'Mesa creada correctamente', icon: 'success', allowEscapeKey: false, allowOutsideClick: false}); }
    }
  };

  const handleEditar = async (mesa: Mesa) => {
    const { value: formValues } = await Swal.fire({
      title: `<span style="font-weight:700; color:#1e293b;">Editar ${mesa.numero}</span>`,
      html: `
        <div style="text-align: left; padding: 10px 15px;">
          <div style="margin-bottom: 16px;">
            <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:4px;">Nombre</label>
            <input id="m-numero" class="swal2-input" style="width:100%; margin:0;" value="${mesa.numero}">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom:16px;">
            <div>
              <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Capacidad</label>
              <input id="m-capacidad" type="number" class="swal2-input" style="width:100%; margin:0;" value="${mesa.capacidad}">
            </div>
            <div>
              <label style="display:block; font-size:13px; font-weight:600; color:#475569;">Zona</label>
              <input id="m-zona" class="swal2-input" style="width:100%; margin:0;" value="${mesa.zona}">
            </div>
          </div>

          <div>
            <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:4px;">Estado Actual</label>
            <select id="m-estado" class="swal2-input" style="width:100%; margin:0;">
              <option value="Libre" ${mesa.estado === 'Libre' ? 'selected' : ''}>🟢 Libre</option>
              <option value="Ocupada" ${mesa.estado === 'Ocupada' ? 'selected' : ''}>🔴 Ocupada</option>
              <option value="Reservada" ${mesa.estado === 'Reservada' ? 'selected' : ''}>🟡 Reservada</option>
              <option value="Mantenimiento" ${mesa.estado === 'Mantenimiento' ? 'selected' : ''}>⚪ Mantenimiento</option>
            </select>
          </div>
        </div>
      `,
      width: '500px',
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false,
      preConfirm: () => ({
        id: mesa.id,
        numero: (document.getElementById('m-numero') as HTMLInputElement).value,
        capacidad: (document.getElementById('m-capacidad') as HTMLInputElement).value,
        zona: (document.getElementById('m-zona') as HTMLInputElement).value,
        estado: (document.getElementById('m-estado') as HTMLSelectElement).value
      })
    });

    if (formValues) {
      const res = await fetch('/api/mesas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      if (res.ok) { fetchMesas(); Swal.fire({title: '¡Actualizado!', text: '', icon: 'success', allowEscapeKey: false, allowOutsideClick: false}); }
    }
  };

  const handleEliminar = async (id: number, numero: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar Mesa?',
      text: `¿Deseas quitar la "${numero}" del sistema?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false
    });

    if (result.isConfirmed) {
      Swal.fire({ title: 'Validando...', didOpen: () => Swal.showLoading() });
      
      const res = await fetch(`/api/mesas?id=${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        Swal.fire({ title: '¡Eliminado!', text: data.message, icon: 'success', allowEscapeKey: false, allowOutsideClick: false });
        fetchMesas();
      } else {
        // Mensaje cuando la mesa está ocupada
        Swal.fire({
          title: 'Acción bloqueada',
          text: data.message,
          icon: 'error',
          confirmButtonColor: '#1e293b',
          allowEscapeKey: false,
          allowOutsideClick: false
        });
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Mesas</h1>
          <p className="text-slate-500 text-sm">Configura la distribución física de tu local</p>
        </div>
        <button onClick={handleAgregar} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all">
          <Plus size={18} /> Nueva Mesa
        </button>
      </div>

      {/* Filtros de Zona */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {zonas.map(zona => (
          <button
            key={zona}
            onClick={() => setFiltroZona(zona)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filtroZona === zona 
              ? 'bg-blue-600 text-white border-blue-600' 
              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
            }`}
          >
            {zona}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
      ) : mesasFiltradas.length === 0 ? (
        <div className="bg-white border rounded-xl py-20 text-center text-slate-400">
           <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
           <p>No hay mesas registradas en esta zona</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {mesasFiltradas.map((mesa) => {
            const estilo = getEstadoEstilo(mesa.estado);
            return (
              <div key={mesa.id} className={`bg-white border-2 ${estilo.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative group`}>
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${estilo.bg} ${estilo.text}`}>
                    <LayoutGrid size={24} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditar(mesa)} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                    <button 
                      onClick={() => {
                        if(mesa.estado === 'Ocupada') {
                          Swal.fire({title: 'Mesa en uso', text: 'No puedes eliminar una mesa con clientes.', icon: 'info', allowEscapeKey: false, allowOutsideClick: false});
                        } else {
                          handleEliminar(mesa.id, mesa.numero);
                        }
                      }} 
                      className={`p-2 transition ${mesa.estado === 'Ocupada' ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600'}`}
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-800">{mesa.numero}</h3>
                
                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Users size={14} /> Capacidad: {mesa.capacidad} pers.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin size={14} /> Zona: {mesa.zona}
                  </div>
                </div>

                <div className={`mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${estilo.text}`}>
                  {estilo.icon}
                  {mesa.estado}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}