'use client';
import { useState, useEffect } from 'react';
import { Calendar, Users, Phone, User, Utensils, CheckCircle2, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function FormularioReservaPage() {
  const [mesas, setMesas] = useState<any[]>([]);
  const [enviado, setEnviado] = useState(false);
  const [formData, setFormData] = useState({
    clienteNombre: '',
    clienteTelefono: '',
    fechaReserva: '',
    numPersonas: '2',
    mesaId: ''
  });

  useEffect(() => {
    fetch('/api/mesas')
      .then(res => res.json())
      .then(data => setMesas(data.filter((m: any) => m.estado === 'Libre')));
  }, []);

  const validarYEnviar = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validaciones manuales con Swal
    if (!formData.clienteNombre.trim()) return Swal.fire({title: 'Atención', text: 'Por favor, ingresa tu nombre.', icon: 'warning', allowEscapeKey: false, allowOutsideClick: false});
    // VALIDACIÓN DE TELÉFONO (Solo números y exactamente 9 dígitos)
    const phoneRegex = /^[0-9]{9}$/;
    if (!phoneRegex.test(formData.clienteTelefono)) {
        return Swal.fire({
            title: 'Teléfono Inválido',
            text: 'El número debe tener exactamente 9 dígitos numéricos.',
            icon: 'warning',
            allowEscapeKey: false,
            allowOutsideClick: false
        });
    }
    if (!formData.fechaReserva) return Swal.fire({title: 'Atención', text: 'Selecciona la fecha y hora de tu reserva.', icon: 'warning', allowEscapeKey: false, allowOutsideClick: false});
    if (!formData.mesaId) return Swal.fire({title: 'Atención', text: 'Debes elegir una mesa.', icon: 'warning', allowEscapeKey: false, allowOutsideClick: false});

    // 2. Confirmación de datos
    const confirmacion = await Swal.fire({
      title: '¿Confirmar Reserva?',
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p><b>Nombre:</b> ${formData.clienteNombre}</p>
          <p><b>Fecha:</b> ${new Date(formData.fechaReserva).toLocaleString()}</p>
          <p><b>Personas:</b> ${formData.numPersonas}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reservar',
      cancelButtonText: 'Revisar',
      confirmButtonColor: '#2563eb',
      allowEscapeKey: false,
      allowOutsideClick: false
    });

    if (confirmacion.isConfirmed) {
      // 3. Spinner de carga
      Swal.fire({
        title: 'Procesando reserva...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      try {
        const res = await fetch('/api/public/reservar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          Swal.close();
          setEnviado(true);
        } else {
          throw new Error();
        }
      } catch (error) {
        Swal.fire('Error', 'No pudimos procesar tu reserva. Inténtalo más tarde.', 'error');
      }
    }
  };

  if (enviado) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md animate-in fade-in zoom-in duration-300">
        <CheckCircle2 size={80} className="text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-black text-slate-800 mb-2">¡Reserva Lista!</h1>
        <p className="text-slate-500">Te esperamos en la fecha y hora seleccionada. ¡Gracias por elegirnos!</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 text-blue-600 font-bold hover:underline"
        >
          Hacer otra reserva
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter">Reserva tu Mesa</h1>
          <p className="text-slate-500 mt-2 font-medium">Completa los datos para asegurar tu lugar</p>
        </div>

        <form onSubmit={validarYEnviar} noValidate className="space-y-4 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-2"><User size={16}/> Nombre Completo</label>
            <input 
              type="text"
              className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="Ej. Gustavo Pérez"
              value={formData.clienteNombre}
              onChange={(e) => setFormData({...formData, clienteNombre: e.target.value})}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-2"><Phone size={16}/> Teléfono</label>
            <input 
              type="tel"
              className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="999 999 999"
              value={formData.clienteTelefono}
              onChange={(e) => setFormData({...formData, clienteTelefono: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-2"><Calendar size={16}/> Fecha y Hora</label>
              <input 
                type="datetime-local"
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all"
                onChange={(e) => setFormData({...formData, fechaReserva: e.target.value})}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-2"><Users size={16}/> Personas</label>
              <select 
                className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 transition-all"
                value={formData.numPersonas}
                onChange={(e) => setFormData({...formData, numPersonas: e.target.value})}
              >
                {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} Personas</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-2"><Utensils size={16}/> Mesa</label>
            <select 
              className="w-full bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 font-bold text-blue-600"
              value={formData.mesaId}
              onChange={(e) => setFormData({...formData, mesaId: e.target.value})}
            >
              <option value="">-- Elige una mesa --</option>
              {mesas.map(m => <option key={m.id} value={m.id}>Mesa #{m.numero}</option>)}
            </select>
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg mt-6 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
          >
            CONFIRMAR RESERVA
          </button>
        </form>
      </div>
    </div>
  );
}