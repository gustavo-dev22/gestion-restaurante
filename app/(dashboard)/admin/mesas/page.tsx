"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  LayoutGrid,
  Users,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Construction,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input, selectBase } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toastSuccess, toastError, toastWarning } from "@/components/ui/Toast";
import { http } from "@/lib/http";

interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  zona: string;
  estado: "Libre" | "Ocupada" | "Reservada" | "Mantenimiento";
  activo: boolean;
}

interface MesaForm {
  numero: string;
  capacidad: string;
  zona: string;
  estado: Mesa["estado"];
}

const emptyForm: MesaForm = { numero: "", capacidad: "4", zona: "", estado: "Libre" };

export default function MesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroZona, setFiltroZona] = useState("Todas");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Mesa | null>(null);
  const [form, setForm] = useState<MesaForm>(emptyForm);
  const [errors, setErrors] = useState<{ numero?: string; zona?: string; capacidad?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Mesa | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMesas = async () => {
    setLoading(true);
    try {
      const data = await http.get<Mesa[]>("/api/mesas");
      if (Array.isArray(data)) setMesas(data);
    } catch {
      setMesas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMesas();
  }, []);

  const zonas = ["Todas", ...Array.from(new Set(mesas.map((mesa) => mesa.zona)))];

  const mesasFiltradas = filtroZona === "Todas" ? mesas : mesas.filter((mesa) => mesa.zona === filtroZona);

  const getEstadoEstilo = (estado: string) => {
    switch (estado) {
      case "Libre":
        return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: <CheckCircle2 size={16} /> };
      case "Ocupada":
        return { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", icon: <XCircle size={16} /> };
      case "Reservada":
        return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: <Clock size={16} /> };
      default:
        return { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-600", icon: <Construction size={16} /> };
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (mesa: Mesa) => {
    setEditing(mesa);
    setForm({
      numero: mesa.numero,
      capacidad: String(mesa.capacidad),
      zona: mesa.zona,
      estado: mesa.estado,
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.numero.trim()) next.numero = "El identificador es obligatorio.";
    if (!form.zona.trim()) next.zona = "La zona es obligatoria.";
    if (!form.capacidad || Number(form.capacidad) < 1) next.capacidad = "La capacidad debe ser al menos 1.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      ...(editing ? { id: editing.id, estado: form.estado } : {}),
      numero: form.numero.trim(),
      capacidad: form.capacidad,
      zona: form.zona.trim(),
    };

    setSaving(true);
    try {
      if (editing) {
        await http.patch("/api/mesas", payload);
      } else {
        await http.post("/api/mesas", payload);
      }

      setFormOpen(false);
      toastSuccess(editing ? "Mesa actualizada" : "Mesa creada", "Los cambios se guardaron correctamente.");
      fetchMesas();
    } catch {
      toastError("No se pudo guardar", "Revisa los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (mesa: Mesa) => {
    if (mesa.estado === "Ocupada") {
      toastWarning("Mesa en uso", "No puedes eliminar una mesa con clientes.");
      return;
    }
    setDeleteTarget(mesa);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const data = await http.delete<{ success: boolean; message: string }>(`/api/mesas?id=${deleteTarget.id}`);
      if (data.success) {
        toastSuccess("Mesa eliminada", data.message);
        setDeleteTarget(null);
        fetchMesas();
      } else {
        toastError("Acción bloqueada", data.message);
      }
    } catch {
      toastError("No se pudo eliminar", "Intenta nuevamente en unos segundos.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Gestión de Mesas"
        description="Configura la distribución física de tu local"
        actions={
          <Button onClick={openCreate}>
            <Plus size={18} /> Nueva Mesa
          </Button>
        }
      />

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {zonas.map((zona) => (
          <button
            key={zona}
            type="button"
            onClick={() => setFiltroZona(zona)}
            aria-pressed={filtroZona === zona}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              filtroZona === zona
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-400"
            }`}
          >
            {zona}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-2xl border-2 border-slate-100 bg-white p-5">
              <Skeleton className="mb-4 h-12 w-12 rounded-xl" />
              <Skeleton className="mb-2 h-5 w-24" />
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : mesasFiltradas.length === 0 ? (
        <div className="rounded-xl border bg-white py-20 text-center text-slate-500">
          <LayoutGrid size={48} className="mx-auto mb-4 opacity-30" />
          <p>No hay mesas registradas en esta zona</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mesasFiltradas.map((mesa) => {
            const estilo = getEstadoEstilo(mesa.estado);
            return (
              <div key={mesa.id} className={`group relative rounded-2xl border-2 bg-white p-5 shadow-sm transition-all hover:shadow-md ${estilo.border}`}>
                <div className="mb-4 flex items-start justify-between">
                  <div className={`rounded-xl p-3 ${estilo.bg} ${estilo.text}`}>
                    <LayoutGrid size={24} />
                  </div>
                  <div className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                    <IconButton label={`Editar ${mesa.numero}`} variant="primary" size="sm" onClick={() => openEdit(mesa)}>
                      <Edit size={16} />
                    </IconButton>
                    <IconButton
                      label={`Eliminar ${mesa.numero}`}
                      variant="danger"
                      size="sm"
                      onClick={() => requestDelete(mesa)}
                      className={mesa.estado === "Ocupada" ? "cursor-not-allowed text-slate-300 hover:bg-transparent hover:text-slate-300" : ""}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-800">{mesa.numero}</h3>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users size={14} /> Capacidad: {mesa.capacidad} pers.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={14} /> Zona: {mesa.zona}
                  </div>
                </div>

                <div className={`mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${estilo.text}`}>
                  {estilo.icon}
                  {mesa.estado}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Editar ${editing.numero}` : "Configurar nueva mesa"}
        description="Define el identificador, capacidad y ubicación."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="mesa-form" loading={saving}>
              {editing ? "Actualizar" : "Guardar mesa"}
            </Button>
          </>
        }
      >
        <form id="mesa-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="mesa-numero" required>
              Nombre / identificador
            </Label>
            <Input
              id="mesa-numero"
              value={form.numero}
              onChange={(event) => setForm({ ...form, numero: event.target.value })}
              error={Boolean(errors.numero)}
              aria-describedby={errors.numero ? "mesa-numero-error" : undefined}
              aria-required="true"
              placeholder="Ej: Mesa 12 o VIP-1"
              autoComplete="off"
            />
            {errors.numero && <FieldError id="mesa-numero-error">{errors.numero}</FieldError>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="mesa-capacidad" required>
                Capacidad
              </Label>
              <Input
                id="mesa-capacidad"
                type="number"
                inputMode="numeric"
                min="1"
                value={form.capacidad}
                onChange={(event) => setForm({ ...form, capacidad: event.target.value })}
                error={Boolean(errors.capacidad)}
                aria-describedby={errors.capacidad ? "mesa-capacidad-error" : undefined}
                aria-required="true"
              />
              {errors.capacidad && <FieldError id="mesa-capacidad-error">{errors.capacidad}</FieldError>}
            </div>

            <div>
              <Label htmlFor="mesa-zona" required>
                Zona / ubicación
              </Label>
              <Input
                id="mesa-zona"
                value={form.zona}
                onChange={(event) => setForm({ ...form, zona: event.target.value })}
                error={Boolean(errors.zona)}
                aria-describedby={errors.zona ? "mesa-zona-error" : undefined}
                aria-required="true"
                placeholder="Ej: Terraza"
                autoComplete="off"
              />
              {errors.zona && <FieldError id="mesa-zona-error">{errors.zona}</FieldError>}
            </div>
          </div>

          {editing && (
            <div>
              <Label htmlFor="mesa-estado">Estado actual</Label>
              <select
                id="mesa-estado"
                value={form.estado}
                onChange={(event) => setForm({ ...form, estado: event.target.value as Mesa["estado"] })}
                className={selectBase}
              >
                <option value="Libre">Libre</option>
                <option value="Ocupada">Ocupada</option>
                <option value="Reservada">Reservada</option>
                <option value="Mantenimiento">Mantenimiento</option>
              </select>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar mesa?"
        description={`¿Deseas quitar la "${deleteTarget?.numero ?? ""}" del sistema?`}
        confirmLabel="Sí, eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
