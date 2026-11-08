"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Volume2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toastSuccess, toastWarning } from "@/components/ui/Toast";
import { formatCurrency, formatTime } from "@/lib/utils";
import { http, getErrorMessage } from "@/lib/http";
import { QR_PENDING_TTL_MS } from "@/lib/order-config";

interface PedidoPendiente {
  id: number;
  total: number | string;
  fecha_creacion: string;
  mesa: { numero: string };
}

export default function NotificacionesMesero({ onPedidoAceptado }: { onPedidoAceptado?: () => void }) {
  const [pendientes, setPendientes] = useState<PedidoPendiente[]>([]);
  const [descartados, setDescartados] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const idsConocidos = useRef<Set<number>>(new Set());

  // El navegador solo permite reproducir audio tras una interacción del usuario.
  useEffect(() => {
    const unlock = () => setAudioEnabled(true);
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  // Actualiza el contador de expiración mientras el modal está abierto.
  useEffect(() => {
    if (!modalOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [modalOpen]);

  const reproducirAlerta = useCallback(() => {
    if (!audioEnabled) return;
    const audio = new Audio("/sounds/notificacion.mp3");
    audio.play().catch(() => {
      // Si el navegador aún bloquea el audio, no interrumpimos el flujo.
    });
  }, [audioEnabled]);

  const buscarNuevosPedidos = useCallback(async () => {
    try {
      const data = await http.get<PedidoPendiente[]>("/api/mesero/pendientes-qr", { timeoutMs: 8_000 });
      const lista: PedidoPendiente[] = Array.isArray(data) ? data : [];

      const nuevos = lista.filter((pedido) => !idsConocidos.current.has(pedido.id));
      if (nuevos.length > 0) reproducirAlerta();

      idsConocidos.current = new Set(lista.map((pedido) => pedido.id));
      setPendientes(lista);
      setDescartados((prev) => {
        const vigentes = new Set(lista.map((pedido) => pedido.id));
        return new Set(Array.from(prev).filter((id) => vigentes.has(id)));
      });
    } catch {
      // Silencioso: se reintenta en el siguiente ciclo.
    }
  }, [reproducirAlerta]);

  useEffect(() => {
    buscarNuevosPedidos();
    const interval = setInterval(buscarNuevosPedidos, 10_000);
    return () => clearInterval(interval);
  }, [buscarNuevosPedidos]);

  const visibles = useMemo(
    () => pendientes.filter((pedido) => !descartados.has(pedido.id)),
    [pendientes, descartados]
  );

  const aceptarPedido = async (pedido: PedidoPendiente) => {
    setClaimingId(pedido.id);
    try {
      await http.patch("/api/mesero/confirmar", { pedidoId: pedido.id });
      toastSuccess("Mesa asignada", `Ahora atiendes la Mesa ${pedido.mesa.numero}.`);
      onPedidoAceptado?.();
      window.dispatchEvent(new Event("gr:mesas-updated"));
      await buscarNuevosPedidos();
    } catch (error) {
      toastWarning(
        "No se pudo tomar el pedido",
        getErrorMessage(error, "Otro mesero pudo haberlo tomado o el pedido expiró.")
      );
      await buscarNuevosPedidos();
    } finally {
      setClaimingId(null);
    }
  };

  const descartar = () => {
    setDescartados((prev) => {
      const next = new Set(prev);
      visibles.forEach((pedido) => next.add(pedido.id));
      return next;
    });
  };

  const restanteLabel = (fecha: string) => {
    const restante = QR_PENDING_TTL_MS - (now - new Date(fecha).getTime());
    if (restante <= 0) return "Expirando...";
    const minutos = Math.floor(restante / 60_000);
    const segundos = Math.floor((restante % 60_000) / 1000);
    return `Expira en ${minutos}:${String(segundos).padStart(2, "0")}`;
  };

  if (visibles.length === 0) return null;

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {visibles.length} pedidos QR pendientes: {visibles.map((pedido) => `Mesa ${pedido.mesa.numero}`).join(", ")}.
      </p>

      <div className="fixed right-4 top-20 z-40 w-[min(92vw,340px)]">
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-xl">
          <div className="relative rounded-full bg-rose-50 p-2 text-rose-600">
            <Bell size={20} />
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-black text-white">
              {visibles.length}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-rose-700">
              Nuevos pedidos QR
            </p>
            <button
              type="button"
              onClick={() => {
                setAudioEnabled(true);
                setNow(Date.now());
                setModalOpen(true);
              }}
              className="mt-0.5 text-sm font-bold text-slate-800 underline hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Ver y tomar
            </button>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
              {audioEnabled ? <Volume2 size={12} /> : <BellOff size={12} />}
              {audioEnabled ? "Alertas de sonido activas" : "Toca para activar el sonido"}
            </p>
          </div>

          <button
            type="button"
            onClick={descartar}
            aria-label="Descartar notificaciones"
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Pedidos QR por tomar"
        description="Cualquier mesero puede tomarlos. Solo el primero que confirme queda asignado."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={() => visibles[0] && aceptarPedido(visibles[0])}
              loading={claimingId !== null && claimingId === visibles[0]?.id}
            >
              Tomar el más antiguo
            </Button>
          </>
        }
      >
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {visibles.map((pedido) => (
            <li
              key={pedido.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <span className="block text-sm font-black uppercase text-slate-800">
                  Mesa {pedido.mesa.numero}
                </span>
                <span className="text-xs text-slate-600">
                  {formatTime(pedido.fecha_creacion)} · {restanteLabel(pedido.fecha_creacion)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="font-black text-blue-700">{formatCurrency(pedido.total)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="success"
                  onClick={() => aceptarPedido(pedido)}
                  loading={claimingId === pedido.id}
                  disabled={claimingId !== null && claimingId !== pedido.id}
                >
                  Tomar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
