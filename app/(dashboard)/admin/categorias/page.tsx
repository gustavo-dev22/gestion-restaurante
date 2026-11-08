"use client";

import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { Plus, Edit, Trash2, Loader2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, selectBase } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { DataTable, DataTablePagination } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toastSuccess, toastError } from "@/components/ui/Toast";

interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  area: string;
  activo: boolean;
  fecha_creacion: string;
}

interface CategoriaForm {
  nombre: string;
  descripcion: string;
  icono: string;
  area: string;
  activo: boolean;
}

const emptyForm: CategoriaForm = {
  nombre: "",
  descripcion: "",
  icono: "Tag",
  area: "Cocina",
  activo: true,
};

const DynamicIcon = ({ name }: { name: string | null }) => {
  const iconMap = Icons as unknown as Record<string, Icons.LucideIcon>;
  const IconComponent = iconMap[name || "Tag"] || Icons.Tag;
  return <IconComponent size={16} />;
};

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState<CategoriaForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategorias = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categorias");
      const data = await res.json();
      if (Array.isArray(data)) setCategorias(data);
    } catch {
      setCategorias([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategorias();
  }, []);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = categorias.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(categorias.length / itemsPerPage);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (categoria: Categoria) => {
    setEditing(categoria);
    setForm({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || "",
      icono: categoria.icono || "Tag",
      area: categoria.area,
      activo: categoria.activo,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nombre.trim()) {
      setFormError("El nombre de la categoría es obligatorio.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      ...form,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      ...(editing ? { id: editing.id } : {}),
    };

    try {
      const res = await fetch("/api/categorias", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      setFormOpen(false);
      toastSuccess(editing ? "Categoría actualizada" : "Categoría creada", "Los cambios se guardaron correctamente.");
      fetchCategorias();
    } catch {
      toastError("No se pudo guardar", "Intenta nuevamente en unos segundos.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/categorias?id=${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toastSuccess("Categoría desactivada", data.message);
        setDeleteTarget(null);
        fetchCategorias();
      } else {
        toastError("Acción no permitida", data.message);
      }
    } catch {
      toastError("No se pudo desactivar", "Intenta nuevamente en unos segundos.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Mantenimiento de Categorías"
        description="Organiza las categorías de la carta por área de producción"
        actions={
          <Button onClick={openCreate}>
            <Plus size={18} /> Nueva Categoría
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center py-20 text-slate-500">
            <Loader2 className="mb-2 animate-spin" /> Cargando...
          </div>
        ) : currentItems.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-500">
            <AlertCircle className="mb-2" /> Sin registros
          </div>
        ) : (
          <>
            <DataTable>
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">ID</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Nombre</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Descripción</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600">Área</th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.map((cat) => (
                  <tr key={cat.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-sm text-slate-500">#{cat.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-blue-50 p-2 text-blue-600">
                          <DynamicIcon name={cat.icono} />
                        </div>
                        <span className="font-semibold text-slate-700">{cat.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{cat.descripcion || "Sin descripción"}</td>
                    <td className="px-6 py-4">
                      <Badge tone={cat.area === "Bebidas" ? "blue" : cat.area === "Postres" ? "purple" : "orange"}>
                        {cat.area}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-1">
                        <IconButton label={`Editar ${cat.nombre}`} variant="primary" onClick={() => openEdit(cat)}>
                          <Edit size={18} />
                        </IconButton>
                        <IconButton label={`Desactivar ${cat.nombre}`} variant="danger" onClick={() => setDeleteTarget(cat)}>
                          <Trash2 size={18} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            <DataTablePagination
              page={currentPage}
              totalPages={totalPages}
              onPrev={() => setCurrentPage((prev) => prev - 1)}
              onNext={() => setCurrentPage((prev) => prev + 1)}
              info={
                <p>
                  Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, categorias.length)} de {categorias.length}
                </p>
              }
            />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar categoría" : "Nueva categoría"}
        description="Completa los datos de la categoría."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="categoria-form" loading={saving}>
              {editing ? "Actualizar" : "Guardar"}
            </Button>
          </>
        }
      >
        <form id="categoria-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="cat-nombre" required>
              Nombre
            </Label>
            <Input
              id="cat-nombre"
              value={form.nombre}
              onChange={(event) => {
                setForm({ ...form, nombre: event.target.value });
                if (formError) setFormError(null);
              }}
              error={Boolean(formError)}
              aria-describedby={formError ? "cat-nombre-error" : undefined}
              aria-required="true"
              placeholder="Ej. Bebidas, Fondos..."
              autoComplete="off"
            />
            {formError && <FieldError id="cat-nombre-error">{formError}</FieldError>}
          </div>

          <div>
            <Label htmlFor="cat-descripcion">Descripción</Label>
            <textarea
              id="cat-descripcion"
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
              placeholder="Breve detalle de la categoría..."
              className={`${selectBase} min-h-24 resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cat-area">Área de producción</Label>
              <select
                id="cat-area"
                value={form.area}
                onChange={(event) => setForm({ ...form, area: event.target.value })}
                className={selectBase}
              >
                <option value="Cocina">Cocina</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Postres">Postres</option>
              </select>
            </div>

            <div>
              <Label htmlFor="cat-icono">Icono (Lucide)</Label>
              <Input
                id="cat-icono"
                value={form.icono}
                onChange={(event) => setForm({ ...form, icono: event.target.value })}
                placeholder="Ej: Pizza, Coffee"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="cat-activo"
              type="checkbox"
              checked={form.activo}
              onChange={(event) => setForm({ ...form, activo: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="cat-activo" className="mb-0">
              ¿Está activa?
            </Label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Desactivar categoría?"
        description={`¿Estás seguro de desactivar "${deleteTarget?.nombre ?? ""}"?`}
        confirmLabel="Sí, desactivar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
