"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toastSuccess, toastError } from "@/components/ui/Toast";
import { formatTime } from "@/lib/format";

interface PedidoPendiente {
  id: number;
  total: number | string;
  fecha_creacion: string;
  mesa: { numero: string };
}

export default function NotificacionesMesero({ onPedidoAceptado }: { onPedidoAceptado: () => void }) {
  const [pendientes, setPendientes] = useState<PedidoPendiente[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const usuario = useAuthStore((state) => state.user);

  const buscarNuevosPedidos = useCallback(async () => {
    try {
      const res = await fetch("/api/mesero/pendientes-qr");
      const data = await res.json();
      const lista: PedidoPendiente[] = Array.isArray(data) ? data : [];

      setPendientes((prev) => {
        if (lista.length > prev.length) {
          const audio = new Audio("/sounds/notificacion.mp3");
          audio.play().catch(() => {
            // El navegador puede bloquear el audio hasta que haya interacción del usuario.
          });
        }
        return lista;
      });
    } catch {
      // Silencioso: se reintenta en el siguiente ciclo.
    }
  }, []);

  useEffect(() => {
    buscarNuevosPedidos();
    const interval = setInterval(buscarNuevosPedidos, 10000);
    return () => clearInterval(interval);
  }, [buscarNuevosPedidos]);

  const aceptarPedido = async (pedido: PedidoPendiente) => {
    setAccepting(true);
    try {
      const res = await fetch("/api/mesero/confirmar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedido.id,
          usuarioId: usuario.id,
          nombreMesero: usuario.nombreCompleto,
        }),
      });

      if (!res.ok) throw new Error();

      toastSuccess("Mesa asignada", `Ahora atiendes la Mesa ${pedido.mesa.numero}.`);
      setModalOpen(false);
      onPedidoAceptado();
      buscarNuevosPedidos();
    } catch {
      toastError("No se pudo aceptar el pedido", "Intenta nuevamente en unos segundos.");
    } finally {
      setAccepting(false);
    }
  };

  if (pendientes.length === 0) return null;

  return (
    <>
      <div className="fixed right-4 top-20 z-40">
        <div className="flex items-center gap-4 rounded-2xl border-2 border-white bg-rose-600 p-4 text-white shadow-2xl">
          <div className="relative">
            <Bell size={24} />
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-rose-600 bg-white text-xs font-black text-rose-600">
              {pendientes.length}
            </span>
          </div>
          <div>
            <p className="text-xs font-black uppercase italic">¡Nuevos pedidos QR!</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-sm font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Ver y aceptar
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pedidos por confirmar"
        description="Selecciona el pedido que deseas atender."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={() => aceptarPedido(pendientes[0])}
              loading={accepting}
            >
              Aceptar el más antiguo
            </Button>
          </>
        }
      >
        <ul className="max-h-60 space-y-2 overflow-y-auto">
          {pendientes.map((pedido) => (
            <li
              key={pedido.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="min-w-0 text-left">
                <span className="block text-sm font-black uppercase text-slate-800">
                  Mesa {pedido.mesa.numero}
                </span>
                <span className="text-xs text-slate-600">{formatTime(pedido.fecha_creacion)}</span>
              </div>
              <span className="shrink-0 font-black text-blue-700">S/ {Number(pedido.total).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        {accepting && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" /> Asignando mesa...
          </p>
        )}
      </Modal>
    </>
  );
}
