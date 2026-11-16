"use client";

import { useState } from "react";
import { Banknote, CheckCircle2, Lock, Plus, Receipt, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { toastSuccess } from "@/components/ui/Toast";
import { CASH_PATHS, type CashPermissions } from "@/lib/auth/cash-permissions";
import type { TurnoCajaResumenDto } from "@/lib/caja-types";
import { getErrorMessage, http } from "@/lib/http";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { can } from "./can";
import type { CajaTab } from "./types";

interface TurnoPanelProps {
  turnoData: TurnoCajaResumenDto | null;
  permissions: CashPermissions;
  onRefresh: () => Promise<void>;
  onTabChange: (tab: CajaTab) => void;
}

export function TurnoPanel({
  turnoData,
  permissions,
  onRefresh,
  onTabChange,
}: TurnoPanelProps) {
  const [fondo, setFondo] = useState("");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turno = turnoData?.turno ?? null;
  const abierto = turno?.estado === "Abierto";
  const puedeCrear = can(permissions, CASH_PATHS.turno, "CREAR");
  const puedeEditar = can(permissions, CASH_PATHS.turno, "EDITAR");

  const abrirCaja = async () => {
    setError(null);
    const monto = Number(fondo);
    if (!Number.isFinite(monto) || monto < 0) {
      setError("Ingresa un fondo inicial válido.");
      return;
    }

    setOpening(true);
    try {
      await http.post("/api/caja/turnos", { fondoInicial: monto });
      toastSuccess("Caja abierta", "Ya puedes registrar cobros y movimientos.");
      setFondo("");
      await onRefresh();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo abrir la caja."));
    } finally {
      setOpening(false);
    }
  };

  if (!abierto) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Wallet size={24} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Abrir caja</h2>
              <p className="text-sm text-slate-600">
                Registra el efectivo inicial antes de empezar a cobrar.
              </p>
            </div>
          </div>

          {puedeCrear ? (
            <div className="max-w-sm">
              <Label htmlFor="fondo-inicial" required>
                Fondo inicial
              </Label>
              <Input
                id="fondo-inicial"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={fondo}
                onChange={(event) => {
                  setFondo(event.target.value);
                  if (error) setError(null);
                }}
                error={Boolean(error)}
                aria-describedby={error ? "fondo-error" : undefined}
              />
              {error && (
                <p id="fondo-error" role="alert" className="mt-1.5 text-sm font-medium text-rose-600">
                  {error}
                </p>
              )}
              <Button className="mt-4" onClick={abrirCaja} loading={opening}>
                <Plus size={18} aria-hidden="true" />
                Abrir caja
              </Button>
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
              No tienes permiso para abrir caja. Solicita al administrador o a otro cajero.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
            Estado
          </h3>
          <p className="mt-3 text-2xl font-black text-slate-800">Cerrada</p>
          <p className="mt-1 text-sm text-slate-600">
            Los cobros quedan bloqueados hasta abrir un turno.
          </p>
        </Card>
      </div>
    );
  }

  const resumen = turnoData?.resumen;
  const pagos = turnoData?.pagos ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fondo inicial</p>
          <p className="mt-2 text-2xl font-black text-slate-800">
            {formatCurrency(turno?.fondoInicial ?? 0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ventas del turno</p>
          <p className="mt-2 text-2xl font-black text-slate-800">
            {formatCurrency(resumen?.totalVentas ?? 0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Efectivo esperado</p>
          <p className="mt-2 text-2xl font-black text-slate-800">
            {formatCurrency(resumen?.efectivoEsperado ?? 0)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pendientes de conciliar</p>
          <p className="mt-2 text-2xl font-black text-slate-800">
            {turnoData?.pendientesConciliar ?? 0}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">Turno de {turno?.cajeroNombre}</h2>
              <Badge tone="emerald">Abierto</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Abierto el {turno ? formatDateTime(turno.abiertoEn) : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(permissions, CASH_PATHS.movimientos, "CREAR") && (
              <Button variant="outline" onClick={() => onTabChange("movimientos")}>
                <Receipt size={17} aria-hidden="true" />
                Movimiento
              </Button>
            )}
            {puedeEditar && (
              <Button variant="outline" onClick={() => onTabChange("conciliacion")}>
                <CheckCircle2 size={17} aria-hidden="true" />
                Conciliar
              </Button>
            )}
            {puedeCrear && (
              <Button variant="outline" onClick={() => onTabChange("cobrar")}>
                <Banknote size={17} aria-hidden="true" />
                Cobrar
              </Button>
            )}
            {puedeEditar && (
              <Button variant="secondary" onClick={() => onTabChange("cierre")}>
                <Lock size={17} aria-hidden="true" />
                Cerrar turno
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Efectivo</p>
            <p className="mt-1 text-xl font-black text-emerald-800">
              {formatCurrency(resumen?.totalEfectivo ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Tarjeta</p>
            <p className="mt-1 text-xl font-black text-blue-800">
              {formatCurrency(resumen?.totalTarjeta ?? 0)}
            </p>
          </div>
          <div className="rounded-xl bg-purple-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-purple-700">Billeteras</p>
            <p className="mt-1 text-xl font-black text-purple-800">
              {formatCurrency(resumen?.totalBilleteras ?? 0)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <p className="text-sm text-slate-600">
            Ingresos: <span className="font-bold text-slate-800">{formatCurrency(resumen?.totalIngresos ?? 0)}</span>
          </p>
          <p className="text-sm text-slate-600">
            Retiros: <span className="font-bold text-slate-800">{formatCurrency(resumen?.totalRetiros ?? 0)}</span>
          </p>
          <p className="text-sm text-slate-600">
            Gastos: <span className="font-bold text-slate-800">{formatCurrency(resumen?.totalGastos ?? 0)}</span>
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-800">Últimos cobros</h2>
          <p className="text-sm text-slate-600">Pagos registrados en este turno.</p>
        </div>
        {pagos.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">Aún no hay cobros en este turno.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pagos.slice(-5).reverse().map((pago) => (
              <div key={pago.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-slate-800">
                    Mesa {pago.mesaNumero} · Pedido #{pago.pedidoId}
                  </p>
                  <p className="text-sm text-slate-600">
                    {pago.metodo} · {formatDateTime(pago.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={pago.estado === "Conciliado" ? "emerald" : "amber"}>
                    {pago.estado}
                  </Badge>
                  <span className="font-bold text-slate-800">{formatCurrency(pago.monto)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
