'use client';
import { useEffect, useState } from 'react';
import { LayoutGrid, Loader2, Users, CalendarCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/lib/store';
import NotificacionesMesero from '@/components/mesero/notificacionesMesero';

export default function SalonMeseroPage() {
  const [mesas, setMesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const usuario = useAuthStore((state) => state.user);

  const fetchMesas = async () => {
    const res = await fetch('/api/mesas');
    const data = await res.json();
    setMesas(data);
    setLoading(false);
  };

  useEffect(() => { fetchMesas(); }, []);

  // LÓGICA DE COLORES DINÁMICOS
  const getEstiloMesa = (estado: string) => {
    switch (estado) {
      case 'Libre': return 'border-emerald-100 bg-white hover:border-emerald-400';
      case 'Ocupada': return 'border-rose-100 bg-rose-50';
      case 'Reservada': return 'border-amber-300 bg-amber-50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'; 
      default: return 'border-slate-100 bg-slate-50';
    }
  };

  const getBadgeEstilo = (estado: string) => {
    switch (estado) {
      case 'Libre': return 'bg-emerald-100 text-emerald-700';
      case 'Ocupada': return 'bg-rose-100 text-rose-700';
      case 'Reservada': return 'bg-amber-100 text-amber-700 border border-amber-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleInteraccionMesa = async (mesa: any) => {
    if (mesa.estado === 'Libre') {
      const result = await Swal.fire({
        title: `¿Abrir ${mesa.numero}?`,
        text: "Se iniciará un nuevo pedido para esta mesa.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, abrir mesa',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#10b981',
        allowEscapeKey: false,
        allowOutsideClick: false
      });

      if (result.isConfirmed) {
        const res = await fetch('/api/mesero/salon', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mesaId: mesa.id, usuarioId: usuario.id, nombreMesero: usuario.nombreCompleto })
        });
        
        if (res.ok) {
          const data = await res.json();
          router.push(`/mesero/pedido/${data.pedido.id}`);
        }
      }
    } 
    // NUEVA LÓGICA: BLOQUEO POR RESERVA
    else if (mesa.estado === 'Reservada') {
      return Swal.fire({
        title: 'Mesa Reservada',
        html: `Esta mesa tiene una reserva programada.<br><br><b>Por seguridad, solo el Administrador puede habilitarla cuando llegue el cliente.</b>`,
        icon: 'info',
        confirmButtonColor: '#d97706',
        allowEscapeKey: false,
        allowOutsideClick: false
      });
    }
    else if (mesa.estado === 'Ocupada') {
      Swal.fire({ title: 'Cargando mesa...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

      const res = await fetch(`/api/mesero/pedido/activo?mesaId=${mesa.id}`);
      const data = await res.json();
      Swal.close();

      if (data.pedidoId) {
        if (data.usuarioId !== usuario.id) {
          const nombreDelResponsable = data.nombreMesero || 'Otro mesero';
          return Swal.fire({
            title: 'Mesa Restringida',
            html: `Atendida por: <b class="text-blue-600">${nombreDelResponsable}</b>.<br><small>Solo el mesero responsable puede gestionarla.</small>`,
            icon: 'warning',
            confirmButtonColor: '#64748b',
            allowEscapeKey: false,
            allowOutsideClick: false
          });
        }
        router.push(`/mesero/pedido/resumen/${data.pedidoId}`);
      }
    }
  };

  return (
    <div className="p-6">
      <NotificacionesMesero onPedidoAceptado={fetchMesas} />
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Salón Interactivo</h1>
      <p className="text-slate-500 mb-8">Selecciona una mesa para gestionar el servicio</p>

      {loading ? (
        <Loader2 className="animate-spin mx-auto text-blue-600" size={40} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {mesas.map((mesa) => (
            <div 
              key={mesa.id}
              onClick={() => handleInteraccionMesa(mesa)}
              className={`cursor-pointer rounded-2xl p-5 border-2 transition-all transform hover:scale-105 ${getEstiloMesa(mesa.estado)}`}
            >
              <div className="flex justify-between items-start mb-4">
                {/* Cambiamos icono si es reservada */}
                {mesa.estado === 'Reservada' ? (
                  <CalendarCheck className="text-amber-500" size={32} />
                ) : (
                  <LayoutGrid className={mesa.estado === 'Libre' ? 'text-emerald-500' : 'text-rose-500'} size={32} />
                )}
                
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${getBadgeEstilo(mesa.estado)}`}>
                  {mesa.estado}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-slate-800">{mesa.numero}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Users size={12} /> Capacidad: {mesa.capacidad}
              </p>

              {/* Mostrar quién atiende si está ocupada */}
              {mesa.estado === 'Ocupada' && (
                <div className="mt-3 pt-3 border-t border-rose-100 flex items-center gap-2 text-[10px] font-bold text-rose-600 uppercase tracking-tight">
                  <div className="bg-rose-200 p-1 rounded-full">
                      <Users size={10} />
                  </div>
                  <span className="truncate">Atiende: {mesa.meseroNombre || 'Asignado'}</span>
                </div>
              )}

              {/* Mensaje visual para Reservada */}
              {mesa.estado === 'Reservada' && (
                <div className="mt-3 pt-3 border-t border-amber-200 text-[10px] font-bold text-amber-600 uppercase italic">
                  Bloqueada por reserva
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}