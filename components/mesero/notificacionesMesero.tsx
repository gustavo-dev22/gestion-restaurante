'use client';
import { useEffect, useState } from 'react';
import { Bell, CheckCircle, Utensils, X } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/lib/store';

export default function NotificacionesMesero({ onPedidoAceptado }: { onPedidoAceptado: () => void }) {
  const [pendientes, setPendientes] = useState<any[]>([]);
  const usuario = useAuthStore((state) => state.user);

  const reproducirAlerta = () => {
    const audio = new Audio('/sounds/notificacion.mp3'); // Debes poner un mp3 en public/sounds/
    audio.play().catch(e => console.log("Audio bloqueado por navegador"));
  };

  const buscarNuevosPedidos = async () => {
    const resPedidos = await fetch('/api/mesero/pendientes-qr'); 
    const data = await resPedidos.json();

    // Si llegan pedidos nuevos que no estaban antes, suena la alerta
    if (data.length > pendientes.length) {
      reproducirAlerta();
    }

    setPendientes(data);
  };

  useEffect(() => {
    buscarNuevosPedidos();
    const interval = setInterval(buscarNuevosPedidos, 10000); // Check cada 10 seg
    return () => clearInterval(interval);
  }, []);

  const aceptarPedido = async (pedido: any) => {
    const res = await fetch('/api/mesero/confirmar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedidoId: pedido.id,
        usuarioId: usuario.id,
        nombreMesero: usuario.nombreCompleto
      })
    });

    if (res.ok) {
      Swal.fire('¡Mesa Asignada!', `Ahora atiendes la Mesa ${pedido.mesa.numero}`, 'success');
      onPedidoAceptado(); // Refresca el salón
      buscarNuevosPedidos();
    }
  };

  if (pendientes.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-50 animate-bounce">
      <div className="bg-rose-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white">
        <div className="relative">
          <Bell size={24} className="animate-ring" />
          <span className="absolute -top-2 -right-2 bg-white text-rose-600 text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-rose-600">
            {pendientes.length}
          </span>
        </div>
        <div>
          <p className="text-xs font-black uppercase italic">¡Nuevos Pedidos QR!</p>
          <button 
            onClick={() => {
                // Abrir un modal con la lista
                Swal.fire({
                    title: 'Pedidos por Confirmar',
                    html: `
                        <div class="space-y-2 max-h-60 overflow-y-auto">
                        ${pendientes.map(p => `
                            <div class="flex justify-between items-center p-3 border rounded-xl mb-2 bg-slate-50">
                            <div class="text-left">
                                <span class="block font-black text-slate-800 uppercase text-xs">Mesa ${p.mesa.numero}</span>
                                <span class="text-[10px] text-slate-500">${new Date(p.fecha_creacion).toLocaleTimeString()}</span>
                            </div>
                            <span class="font-black text-blue-600">S/ ${Number(p.total).toFixed(2)}</span>
                            </div>
                        `).join('')}
                        </div>
                    `,
                    showCancelButton: true,
                    confirmButtonText: 'Aceptar el más antiguo', // Lógica simple para empezar
                    confirmButtonColor: '#10b981',
                    cancelButtonText: 'Cerrar',
                    allowEscapeKey: false,
                    allowOutsideClick: false
                    }).then((result) => {
                    if (result.isConfirmed) {
                        // Aceptamos el primer pedido de la lista (el más antiguo)
                        aceptarPedido(pendientes[0]);
                    }
                });
            }}
            className="text-[10px] underline font-bold"
          >
            Click para aceptar
          </button>
        </div>
      </div>
    </div>
  );
}