"use client";

import { useState } from "react";
import { Banknote, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Label } from "@/components/ui/Field";
import { Input, selectBase } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toastError, toastSuccess, toastWarning } from "@/components/ui/Toast";
import { CASH_PATHS, type CashPermissions } from "@/lib/auth/cash-permissions";
import type {
  PedidoPorCobrarDto,
  TurnoCajaResumenDto,
} from "@/lib/caja-types";
import { getErrorMessage, http } from "@/lib/http";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { can } from "./can";

interface CobrarPanelProps {
  turnoData: TurnoCajaResumenDto | null;
  pedidos: PedidoPorCobrarDto[];
  pedidosLoading: boolean;
  permissions: CashPermissions;
  onRefresh: () => Promise<void>;
}

export function CobrarPanel({
  turnoData,
  pedidos,
  pedidosLoading,
  permissions,
  onRefresh,
}: CobrarPanelProps) {
  const [target, setTarget] = useState<PedidoPorCobrarDto | null>(null);
  const [metodo, setMetodo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turno = turnoData?.turno ?? null;
  const abierto = turno?.estado === "Abierto";
  const puedeCobrar = can(permissions, CASH_PATHS.turno, "CREAR");

  const abrirPago = (pedido: PedidoPorCobrarDto) => {
    if (!abierto) {
      toastWarning("Caja cerrada", "Abre un turno antes de cobrar.");
      return;
    }
    if (!puedeCobrar) {
      toastError("Sin permiso", "No tienes permiso para cobrar desde caja.");
      return;
    }
    setTarget(pedido);
    setMetodo("");
    setReferencia("");
    setError(null);
  };

  const cerrar = () => {
    if (paying) return;
    setTarget(null);
    setError(null);
  };

  const pagar = async () => {
    if (!target) return;
    if (!metodo) {
      setError("Selecciona un método de pago.");
      return;
    }

    setPaying(true);
    setError(null);
    try {
      await http.post("/api/caja/pedido/pagar", {
        pedidoId: target.id,
        metodoPago: metodo,
        referencia: referencia.trim() || null,
      });
      toastSuccess("Pago registrado", "La mesa fue liberada.");
      setTarget(null);
      await onRefresh();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo procesar el pago."));
    } finally {
      setPaying(false);
    }
  };

  if (!abierto) {
    return (
      <Card className="p-6">
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Caja cerrada. Abre un turno para cobrar pedidos.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Banknote size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Pedidos por cobrar</h2>
            <p className="text-sm text-slate-600">
              Pedidos pendientes con todos sus platos listos.
            </p>
          </div>
        </div>
      </Card>

      {pedidosLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : pedidos.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No hay pedidos listos para cobrar"
            description="Cuando cocina marque todos los platos como listos, aparecerán aquí."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => (
            <Card key={pedido.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-800">
                      Mesa {pedido.mesaNumero} · Pedido #{pedido.id}
                    </h3>
                    <Badge tone="amber">Pendiente de pago</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {pedido.meseroNombre ? `Mesero: ${pedido.meseroNombre} · ` : ""}
                    {formatDateTime(pedido.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {pedido.detalles
                      .map((detalle) => `${detalle.cantidad}x ${detalle.nombre}`)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-slate-800">
                    {formatCurrency(pedido.total)}
                  </span>
                  {puedeCobrar ? (
                    <Button onClick={() => abrirPago(pedido)}>
                      <Banknote size={17} aria-hidden="true" />
                      Cobrar
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">
                      Sin permiso
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(target)}
        onClose={cerrar}
        title={target ? `Cobrar pedido #${target.id}` : "Cobrar pedido"}
        description={
          target
            ? `Mesa ${target.mesaNumero} · Total ${formatCurrency(target.total)}`
            : undefined
        }
        closeOnBackdrop={!paying}
        showCloseButton={!paying}
        footer={
          <>
            <Button variant="outline" onClick={cerrar} disabled={paying}>
              Cancelar
            </Button>
            <Button variant="success" onClick={pagar} loading={paying}>
              Confirmar pago
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="caja-metodo" required>
              Método de pago
            </Label>
            <select
              id="caja-metodo"
              className={selectBase}
              value={metodo}
              onChange={(event) => {
                setMetodo(event.target.value);
                if (error) setError(null);
              }}
              disabled={paying}
            >
              <option value="">Selecciona método</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta / POS</option>
              <option value="Yape/Plin">Yape / Plin</option>
            </select>
          </div>

          {metodo && metodo !== "Efectivo" && (
            <div>
              <Label htmlFor="caja-referencia">Referencia / operación</Label>
              <Input
                id="caja-referencia"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                placeholder="Código de terminal, Yape o Plin"
                maxLength={100}
                disabled={paying}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
