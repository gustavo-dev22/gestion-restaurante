'use client';
import { useEffect, useState } from 'react';
import { User, Phone, Users, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { http } from '@/lib/http';
import { formatDateTime } from '@/lib/utils';

export default function GestionReservasPage() {
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ id: number; mesaId: number; estado: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchReservas = async () => {
    try {
      const data = await http.get<any[]>('/api/admin/reservas');
      setReservas(Array.isArray(data) ? data : []);
    } catch {
      setReservas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReservas(); }, []);

  const cambiarEstado = async () => {
    if (!pending) return;
    setUpdating(true);
    try {
      await http.patch('/api/admin/reservas', {
        id: pending.id,
        nuevoEstado: pending.estado,
        mesaId: pending.mesaId,
      });

      toastSuccess('Reserva actualizada', `Reserva marcada como ${pending.estado}.`);
      setPending(null);
      fetchReservas();
    } catch {
      toastError('No se pudo actualizar', 'Intenta nuevamente en unos segundos.');
    } finally {
      setUpdating(false);
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
          <p className="text-slate-600 italic">No hay reservas registradas hoy.</p>
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
                <p className="text-sm text-slate-600 flex items-center gap-2"><Clock size={14}/> {formatDateTime(r.fechaReserva)}</p>
                <p className="text-sm text-slate-500 flex items-center gap-2"><Users size={14}/> {r.numPersonas} Personas - <b>Mesa {r.mesa.numero}</b></p>
              </div>

              {r.estado === 'Confirmada' && (
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setPending({ id: r.id, mesaId: r.mesaId, estado: 'Finalizada' })}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <CheckCircle size={14} /> Llegó
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPending({ id: r.id, mesaId: r.mesaId, estado: 'Cancelada' })}
                    className="flex-1 bg-rose-50 text-rose-700 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <XCircle size={14} /> Cancelar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={cambiarEstado}
        title={pending ? `¿Marcar como ${pending.estado}?` : "Actualizar reserva"}
        description="Esto actualizará la disponibilidad de la mesa en el salón."
        confirmLabel="Confirmar"
        variant={pending?.estado === "Cancelada" ? "danger" : "success"}
        loading={updating}
      />
    </div>
  );
}