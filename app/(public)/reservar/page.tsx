"use client";

import { useEffect, useState } from "react";
import { Calendar, Users, Phone, User, Utensils, CheckCircle2 } from "lucide-react";
import { Input, selectBase } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toastError } from "@/components/ui/Toast";
import { http } from "@/lib/http";

interface ReservaForm {
  clienteNombre: string;
  clienteTelefono: string;
  fechaReserva: string;
  numPersonas: string;
  mesaId: string;
}

type FormErrors = Partial<Record<keyof ReservaForm, string>>;

const initialForm: ReservaForm = {
  clienteNombre: "",
  clienteTelefono: "",
  fechaReserva: "",
  numPersonas: "2",
  mesaId: "",
};

export default function FormularioReservaPage() {
  const [mesas, setMesas] = useState<any[]>([]);
  const [loadingMesas, setLoadingMesas] = useState(true);
  const [enviado, setEnviado] = useState(false);
  const [formData, setFormData] = useState<ReservaForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    http
      .get<any[]>("/api/mesas", { skipAuthRedirect: true })
      .then((data) => setMesas(Array.isArray(data) ? data.filter((mesa) => mesa.estado === "Libre") : []))
      .catch(() => setMesas([]))
      .finally(() => setLoadingMesas(false));
  }, []);

  const updateField = (field: keyof ReservaForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next: FormErrors = {};
    if (!formData.clienteNombre.trim()) next.clienteNombre = "Ingresa tu nombre.";
    if (!/^[0-9]{9}$/.test(formData.clienteTelefono)) {
      next.clienteTelefono = "El teléfono debe tener exactamente 9 dígitos numéricos.";
    }
    if (!formData.fechaReserva) next.fechaReserva = "Selecciona la fecha y hora de tu reserva.";
    if (!formData.mesaId) next.mesaId = "Debes elegir una mesa.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const confirmarReserva = async () => {
    setSending(true);
    try {
      await http.post("/api/public/reservar", formData, { skipAuthRedirect: true });

      setConfirmOpen(false);
      setEnviado(true);
    } catch {
      toastError("No pudimos procesar tu reserva", "Inténtalo nuevamente en unos segundos.");
    } finally {
      setSending(false);
    }
  };

  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  if (enviado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md rounded-3xl bg-white p-10 shadow-xl">
          <CheckCircle2 size={80} className="mx-auto mb-6 text-green-500" />
          <h1 className="mb-2 text-3xl font-black text-slate-800">¡Reserva lista!</h1>
          <p className="text-slate-600">Te esperamos en la fecha y hora seleccionada. ¡Gracias por elegirnos!</p>
          <Button
            type="button"
            className="mt-6"
            onClick={() => {
              setFormData(initialForm);
              setErrors({});
              setEnviado(false);
            }}
          >
            Hacer otra reserva
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-800">Reserva tu Mesa</h1>
          <p className="mt-2 font-medium text-slate-600">Completa los datos para asegurar tu lugar</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div>
            <Label htmlFor="reserva-nombre" required>
              <span className="inline-flex items-center gap-2">
                <User size={16} aria-hidden="true" /> Nombre completo
              </span>
            </Label>
            <Input
              id="reserva-nombre"
              name="name"
              autoComplete="name"
              value={formData.clienteNombre}
              onChange={(event) => updateField("clienteNombre", event.target.value)}
              error={Boolean(errors.clienteNombre)}
              aria-describedby={errors.clienteNombre ? "reserva-nombre-error" : undefined}
              aria-required="true"
              placeholder="Ej. Gustavo Pérez"
            />
            {errors.clienteNombre && <FieldError id="reserva-nombre-error">{errors.clienteNombre}</FieldError>}
          </div>

          <div>
            <Label htmlFor="reserva-telefono" required>
              <span className="inline-flex items-center gap-2">
                <Phone size={16} aria-hidden="true" /> Teléfono
              </span>
            </Label>
            <Input
              id="reserva-telefono"
              name="tel"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={9}
              value={formData.clienteTelefono}
              onChange={(event) => updateField("clienteTelefono", event.target.value.replace(/\D/g, ""))}
              error={Boolean(errors.clienteTelefono)}
              aria-describedby={errors.clienteTelefono ? "reserva-telefono-error" : undefined}
              aria-required="true"
              placeholder="999999999"
            />
            {errors.clienteTelefono && <FieldError id="reserva-telefono-error">{errors.clienteTelefono}</FieldError>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="reserva-fecha" required>
                <span className="inline-flex items-center gap-2">
                  <Calendar size={16} aria-hidden="true" /> Fecha y hora
                </span>
              </Label>
              <Input
                id="reserva-fecha"
                type="datetime-local"
                min={minDateTime}
                value={formData.fechaReserva}
                onChange={(event) => updateField("fechaReserva", event.target.value)}
                error={Boolean(errors.fechaReserva)}
                aria-describedby={errors.fechaReserva ? "reserva-fecha-error" : undefined}
                aria-required="true"
              />
              {errors.fechaReserva && <FieldError id="reserva-fecha-error">{errors.fechaReserva}</FieldError>}
            </div>
            <div>
              <Label htmlFor="reserva-personas" required>
                <span className="inline-flex items-center gap-2">
                  <Users size={16} aria-hidden="true" /> Personas
                </span>
              </Label>
              <select
                id="reserva-personas"
                value={formData.numPersonas}
                onChange={(event) => updateField("numPersonas", event.target.value)}
                className={selectBase}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "persona" : "personas"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="reserva-mesa" required>
              <span className="inline-flex items-center gap-2">
                <Utensils size={16} aria-hidden="true" /> Mesa
              </span>
            </Label>
            <select
              id="reserva-mesa"
              value={formData.mesaId}
              onChange={(event) => updateField("mesaId", event.target.value)}
              className={selectBase}
              disabled={loadingMesas}
              aria-describedby={errors.mesaId ? "reserva-mesa-error" : undefined}
              aria-required="true"
            >
              <option value="">{loadingMesas ? "Cargando mesas..." : "-- Elige una mesa --"}</option>
              {mesas.map((mesa) => (
                <option key={mesa.id} value={mesa.id}>
                  Mesa #{mesa.numero} · {mesa.zona} · {mesa.capacidad} pers.
                </option>
              ))}
            </select>
            {errors.mesaId && <FieldError id="reserva-mesa-error">{errors.mesaId}</FieldError>}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loadingMesas}>
            Confirmar reserva
          </Button>
        </form>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmarReserva}
        title="¿Confirmar reserva?"
        description={
          <div className="space-y-1">
            <p>
              <span className="font-semibold">Nombre:</span> {formData.clienteNombre}
            </p>
            <p>
              <span className="font-semibold">Fecha:</span>{" "}
              {formData.fechaReserva ? new Date(formData.fechaReserva).toLocaleString("es-PE") : "—"}
            </p>
            <p>
              <span className="font-semibold">Personas:</span> {formData.numPersonas}
            </p>
          </div>
        }
        confirmLabel="Sí, reservar"
        cancelLabel="Revisar"
        variant="default"
        loading={sending}
      />
    </div>
  );
}
