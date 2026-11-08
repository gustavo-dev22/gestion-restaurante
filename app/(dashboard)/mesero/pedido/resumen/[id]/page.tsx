"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Plus, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Label } from "@/components/ui/Field";
import { selectBase } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toastSuccess, toastError, toastWarning } from "@/components/ui/Toast";

export default function ResumenPedido() {
  const params = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [metodo, setMetodo] = useState("");
  const [metodoError, setMetodoError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const fetchPedido = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/mesero/pedido/resumen?id=${params.id}`);
      const data = await res.json();
      if (!data?.mesa) throw new Error();
      setPedido(data);
    } catch {
      setError(true);
      setPedido(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchPedido();
  }, [fetchPedido]);

  const handleCancelarApertura = async () => {
    setCanceling(true);
    try {
      const res = await fetch(`/api/mesero/pedido/cancelar?id=${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCancelOpen(false);
      toastSuccess("Mesa liberada", "La apertura del pedido fue anulada.");
      router.push("/mesero/salon");
    } catch {
      toastError("No se pudo cancelar", "No se puede cancelar si ya hay platos enviados.");
    } finally {
      setCanceling(false);
    }
  };

  const abrirPago = () => {
    setMetodo("");
    setMetodoError(null);
    setPayOpen(true);
  };

  const confirmarPago = async () => {
    if (!metodo) {
      setMetodoError("Debes seleccionar un método de pago.");
      return;
    }

    setPaying(true);
    try {
      const res = await fetch("/api/mesero/pedido/pagar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: params.id, metodoPago: metodo }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "COCINA_PENDIENTE") {
          toastWarning("Espera un momento", data.message);
        } else {
          toastError("No se pudo procesar el pago", "Intenta nuevamente en unos segundos.");
        }
        return;
      }

      setPayOpen(false);
      toastSuccess("Venta exitosa", "La mesa ha sido liberada.");
      router.push("/mesero/salon");
    } catch {
      toastError("No se pudo procesar el pago", "Intenta nuevamente en unos segundos.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-slate-500">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold text-slate-800">No se pudo cargar el pedido</p>
        <p className="text-slate-600">Revisa la conexión e inténtalo nuevamente.</p>
        <Button onClick={fetchPedido}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-8 flex items-center gap-4">
        <IconButton label="Volver al salón" variant="outline" onClick={() => router.push("/mesero/salon")}>
          <ChevronLeft size={20} />
        </IconButton>
        <h1 className="text-2xl font-bold text-slate-800">Resumen {pedido.mesa.numero}</h1>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-600">Consumo actual</h2>
        <div className="space-y-4">
          {pedido.detalles.map((det: any) => (
            <div key={det.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-800">{det.producto.nombre}</p>
                  <Badge tone={det.estado === "Listo" ? "emerald" : "amber"}>{det.estado}</Badge>
                </div>
                <p className="text-sm text-slate-600">
                  {det.cantidad} x S/ {Number(det.precio_unitario).toFixed(2)}
                </p>
              </div>
              <span className="shrink-0 font-bold text-slate-700">
                S/ {(Number(det.precio_unitario) * det.cantidad).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-6">
          <span className="font-medium text-slate-600">Total a pagar</span>
          <span className="text-3xl font-black text-blue-700">S/ {Number(pedido.total).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={() => router.push(`/mesero/pedido/${params.id}`)}
        >
          <Plus size={20} /> Agregar más
        </Button>
        <Button type="button" variant="success" size="lg" className="flex-1" onClick={abrirPago}>
          <Receipt size={20} /> Pagar cuenta
        </Button>
      </div>

      {pedido.detalles.length === 0 && (
        <button
          type="button"
          onClick={() => setCancelOpen(true)}
          className="mt-6 text-sm font-medium text-slate-600 underline transition-colors hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          Anular apertura de mesa
        </button>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancelarApertura}
        title="¿Anular apertura?"
        description="La mesa volverá a estar disponible."
        confirmLabel="Sí, liberar mesa"
        variant="danger"
        loading={canceling}
      />

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Finalizar pedido"
        description={`Total a cobrar: S/ ${Number(pedido.total).toFixed(2)}`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>
              Cancelar
            </Button>
            <Button type="button" variant="success" onClick={confirmarPago} loading={paying}>
              Confirmar pago
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="metodo-pago" required>
            Método de pago
          </Label>
          <select
            id="metodo-pago"
            value={metodo}
            onChange={(event) => {
              setMetodo(event.target.value);
              if (metodoError) setMetodoError(null);
            }}
            className={selectBase}
            aria-describedby={metodoError ? "metodo-pago-error" : undefined}
            aria-required="true"
          >
            <option value="">Selecciona método de pago</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta / POS</option>
            <option value="Yape/Plin">Yape / Plin</option>
          </select>
          {metodoError && (
            <p id="metodo-pago-error" role="alert" className="mt-1.5 text-sm font-medium text-rose-600">
              {metodoError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
