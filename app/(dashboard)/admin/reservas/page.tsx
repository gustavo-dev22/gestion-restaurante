'use client';
import { useEffect, useState } from 'react';
import { User, Phone, Users, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';

export default function GestionReservasPage() {
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReservas = async () => {
    const res = await fetch('/api/admin/reservas');
    const data = await res.json();
    setReservas(data);
    setLoading(false);
  };

  useEffect(() => { fetchReservas(); }, []);

  const cambiarEstado = async (id: number, mesaId: number, estado: string) => {
    const confirm = await Swal.fire({
      title: `¿Marcar como ${estado}?`,
      text: "Esto actualizará la disponibilidad de la mesa en el salón.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false
    });

    if (confirm.isConfirmed) {
      const res = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nuevoEstado: estado, mesaId })
      });

      if (res.ok) {
        Swal.fire({title: 'Actualizado', text: `Reserva marcada como ${estado}`, icon: 'success', allowEscapeKey: false, allowOutsideClick: false});
        fetchReservas();
      }
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="p-6">
      <PageHeader
        title="Control de Reservas"
        description="Administra las llegadas y disponibilidad de mesas reservadas"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reservas.length === 0 ? (
          <p className="text-slate-400 italic">No hay reservas registradas hoy.</p>
        ) : (
          reservas.map((r) => (
            <div key={r.id} className={`bg-white border-2 rounded-3xl p-6 transition-all ${
              r.estado === 'Confirmada' ? 'border-amber-100' : 'border-slate-100 opacity-60'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                  <User size={24} />
                </div>
                <Badge tone={r.estado === 'Confirmada' ? 'amber' : r.estado === 'Finalizada' ? 'emerald' : 'rose'}>
                  {r.estado}
                </Badge>
              </div>

              <h3 className="text-xl font-bold text-slate-800 mb-1">{r.clienteNombre}</h3>
              <div className="space-y-2 mb-6">
                <p className="text-sm text-slate-500 flex items-center gap-2"><Phone size={14}/> {r.clienteTelefono}</p>
                <p className="text-sm text-slate-500 flex items-center gap-2"><Clock size={14}/> {new Date(r.fechaReserva).toLocaleString('es-PE', { timeZone: 'UTC' })}</p>
                <p className="text-sm text-slate-500 flex items-center gap-2"><Users size={14}/> {r.numPersonas} Personas - <b>Mesa {r.mesa.numero}</b></p>
              </div>

              {r.estado === 'Confirmada' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => cambiarEstado(r.id, r.mesaId, 'Finalizada')}
                    className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-600"
                  >
                    <CheckCircle size={14} /> LLEGÓ
                  </button>
                  <button 
                    onClick={() => cambiarEstado(r.id, r.mesaId, 'Cancelada')}
                    className="flex-1 bg-rose-100 text-rose-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-rose-200"
                  >
                    <XCircle size={14} /> CANCELAR
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}