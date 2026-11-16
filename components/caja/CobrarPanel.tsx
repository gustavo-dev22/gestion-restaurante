"use client";

import { useRouter } from "next/navigation";
import { Banknote, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  PedidoPorCobrarDto,
  TurnoCajaResumenDto,
} from "@/lib/caja-types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface CobrarPanelProps {
  turnoData: TurnoCajaResumenDto | null;
  pedidos: PedidoPorCobrarDto[];
  pedidosLoading: boolean;
}

export function CobrarPanel({
  turnoData,
  pedidos,
  pedidosLoading,
}: CobrarPanelProps) {
  const router = useRouter();
  const turno = turnoData?.turno ?? null;
  const abierto = turno?.estado === "Abierto";

  if (!abierto) {
    return (
      <Card className="p-6">
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Caja cerrada. Abre un turno para gestionar cuentas y cobros.
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
            <h2 className="text-lg font-bold text-slate-800">Cuentas por cobrar</h2>
            <p className="text-sm text-slate-600">
              Abre una cuenta para pagos parciales, división, propinas, descuentos y devoluciones.
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
                    <Badge tone={pedido.estadoPago === "Parcial" ? "amber" : "neutral"}>
                      {pedido.estadoPago === "Parcial" ? "Pago parcial" : "Pendiente de pago"}
                    </Badge>
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
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p className="text-slate-600">
                      Total: <b className="text-slate-800">{formatCurrency(pedido.total)}</b>
                    </p>
                    <p className="text-slate-600">
                      Pagado: <b className="text-slate-800">{formatCurrency(pedido.totalPagado)}</b>
                    </p>
                    <p className="text-base">
                      Saldo: <b className="text-blue-700">{formatCurrency(pedido.saldo)}</b>
                    </p>
                  </div>
                  <Button onClick={() => router.push(`/caja/pedidos/${pedido.id}`)}>
                    <Receipt size={17} aria-hidden="true" />
                    Ver cuenta
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
