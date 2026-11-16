"use client";

import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Field";
import { Input, selectBase, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { toastSuccess } from "@/components/ui/Toast";
import { CASH_PATHS, type CashPermissions } from "@/lib/auth/cash-permissions";
import type { TurnoCajaResumenDto } from "@/lib/caja-types";
import { getErrorMessage, http } from "@/lib/http";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { can } from "./can";

interface MovimientosPanelProps {
  turnoData: TurnoCajaResumenDto | null;
  permissions: CashPermissions;
  onRefresh: () => Promise<void>;
}

export function MovimientosPanel({
  turnoData,
  permissions,
  onRefresh,
}: MovimientosPanelProps) {
  const [tipo, setTipo] = useState("Gasto");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turno = turnoData?.turno ?? null;
  const abierto = turno?.estado === "Abierto";
  const puedeCrear = can(permissions, CASH_PATHS.movimientos, "CREAR");

  const registrar = async () => {
    setError(null);
    if (!turno) {
      setError("No hay un turno abierto.");
      return;
    }

    const importe = Number(monto);
    if (!Number.isFinite(importe) || importe <= 0) {
      setError("Ingresa un monto mayor a cero.");
      return;
    }
    if (motivo.trim().length < 3) {
      setError("Describe el motivo del movimiento.");
      return;
    }

    setSaving(true);
    try {
      await http.post(`/api/caja/turnos/${turno.id}/movimientos`, {
        tipo,
        monto: importe,
        motivo: motivo.trim(),
      });
      toastSuccess("Movimiento registrado", "El efectivo esperado fue actualizado.");
      setMonto("");
      setMotivo("");
      await onRefresh();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo registrar el movimiento."));
    } finally {
      setSaving(false);
    }
  };

  const movimientos = turnoData?.movimientos ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Receipt size={22} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Nuevo movimiento</h2>
            <p className="text-sm text-slate-600">Retiro, gasto menor o ingreso.</p>
          </div>
        </div>

        {!abierto ? (
          <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
            Abre un turno para registrar movimientos.
          </p>
        ) : !puedeCrear ? (
          <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
            No tienes permiso para registrar movimientos.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="mov-tipo" required>
                Tipo
              </Label>
              <select
                id="mov-tipo"
                className={selectBase}
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
              >
                <option value="Gasto">Gasto menor</option>
                <option value="Retiro">Retiro</option>
                <option value="Ingreso">Ingreso</option>
              </select>
            </div>
            <div>
              <Label htmlFor="mov-monto" required>
                Monto
              </Label>
              <Input
                id="mov-monto"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mov-motivo" required>
                Motivo
              </Label>
              <Textarea
                id="mov-motivo"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Ej. compra de hielo, retiro a caja fuerte..."
                maxLength={300}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-rose-600">
                {error}
              </p>
            )}
            <Button className="w-full" onClick={registrar} loading={saving}>
              <Plus size={18} aria-hidden="true" />
              Registrar movimiento
            </Button>
          </div>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-800">Movimientos del turno</h2>
          <p className="text-sm text-slate-600">
            Los movimientos no se editan; si hay un error, registra el movimiento contrario.
          </p>
        </div>
        {movimientos.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Sin movimientos"
            description="Los retiros, gastos e ingresos aparecerán aquí."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {[...movimientos].reverse().map((movimiento) => (
              <div key={movimiento.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        movimiento.tipo === "Ingreso"
                          ? "emerald"
                          : movimiento.tipo === "Retiro"
                            ? "blue"
                            : "amber"
                      }
                    >
                      {movimiento.tipo}
                    </Badge>
                    <p className="font-semibold text-slate-800">
                      {formatCurrency(movimiento.monto)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{movimiento.motivo}</p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  <p>{movimiento.usuarioNombre}</p>
                  <p>{formatDateTime(movimiento.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
