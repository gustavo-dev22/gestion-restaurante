"use client";

import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { Plus, Edit, Trash2, Package, Loader2, Search, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, selectBase } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { DataTable, DataTablePagination } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toastSuccess, toastError } from "@/components/ui/Toast";
import { http } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";

interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  categoriaId: number;
  categoria: { nombre: string; icono: string | null };
  imagen_url: string | null;
  activo: boolean;
}

interface CategoriaOption {
  id: number;
  nombre: string;
}

interface ProductoForm {
  nombre: string;
  precio: string;
  categoriaId: string;
  descripcion: string;
  imagen_url: string;
  stock: string;
}

const emptyForm: ProductoForm = {
  nombre: "",
  precio: "",
  categoriaId: "",
  descripcion: "",
  imagen_url: "",
  stock: "0",
};

const DynamicIcon = ({ name }: { name: string | null }) => {
  const iconMap = Icons as unknown as Record<string, Icons.LucideIcon>;
  const IconComponent = iconMap[name || "Tag"] || Icons.Tag;
  return <IconComponent size={16} />;
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState<ProductoForm>(emptyForm);
  const [errors, setErrors] = useState<{ nombre?: string; precio?: string; categoriaId?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Producto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategorias = async () => {
    try {
      const data = await http.get<CategoriaOption[]>("/api/categorias");
      if (Array.isArray(data)) setCategorias(data);
    } catch {
      setCategorias([]);
    }
  };

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const data = await http.get<Producto[]>("/api/productos");
      if (Array.isArray(data)) setProductos(data);
    } catch {
      setProductos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
  }, []);

  const productosFiltrados = productos.filter(
    (producto) =>
      producto.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      producto.categoria?.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = productosFiltrados.slice(indexOfFirstItem, indexOfLastItem);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, categoriaId: String(categorias[0]?.id ?? "") });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (producto: Producto) => {
    setEditing(producto);
    setForm({
      nombre: producto.nombre,
      precio: String(producto.precio),
      categoriaId: String(producto.categoriaId),
      descripcion: producto.descripcion || "",
      imagen_url: producto.imagen_url || "",
      stock: String(producto.stock),
    });
    setErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!form.nombre.trim()) next.nombre = "El nombre es obligatorio.";
    if (!form.precio.trim() || Number(form.precio) <= 0) next.precio = "Ingresa un precio mayor a 0.";
    if (!form.categoriaId) next.categoriaId = "Selecciona una categoría.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      ...(editing ? { id: editing.id } : {}),
      nombre: form.nombre.trim(),
      precio: form.precio,
      categoriaId: form.categoriaId,
      descripcion: form.descripcion.trim(),
      imagen_url: form.imagen_url.trim(),
      stock: form.stock || "0",
    };

    setSaving(true);
    try {
      if (editing) {
        await http.patch("/api/productos", payload);
      } else {
        await http.post("/api/productos", payload);
      }

      setFormOpen(false);
      toastSuccess(
        editing ? "Producto actualizado" : "Producto creado",
        "Los cambios se guardaron correctamente."
      );
      fetchProductos();
    } catch {
      toastError("No se pudo guardar", "Revisa los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await http.delete(`/api/productos?id=${deleteTarget.id}`);
      toastSuccess("Producto eliminado", `${deleteTarget.nombre} se quitó de la carta.`);
      setDeleteTarget(null);
      fetchProductos();
    } catch {
      toastError("No se pudo eliminar", "Intenta nuevamente en unos segundos.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Productos"
        description="Control de platos e inventario"
        actions={
          <Button onClick={openCreate}>
            <Plus size={18} /> Nuevo Producto
          </Button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          size={18}
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Buscar por nombre o categoría..."
          className="pl-10"
          aria-label="Buscar productos"
          value={filtro}
          onChange={(event) => {
            setFiltro(event.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <DataTable>
          <thead className="border-b bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Producto</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Categoría</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Precio</th>
              <th className="px-6 py-4 text-xs font-bold uppercase text-slate-600">Stock</th>
              <th className="px-6 py-4 text-center text-xs font-bold uppercase text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-slate-500">
                  <Loader2 className="mr-2 inline animate-spin" /> Cargando...
                </td>
              </tr>
            ) : currentItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center text-slate-500">
                    <AlertCircle size={40} className="mb-2 opacity-40" />
                    <p className="text-lg font-medium">No se encontraron resultados</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentItems.map((prod) => (
                <tr key={prod.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {prod.imagen_url ? (
                        <img
                          src={prod.imagen_url}
                          className="h-10 w-10 rounded-lg border object-cover"
                          alt={`Imagen de ${prod.nombre}`}
                        />
                      ) : (
                        <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                          <Package size={18} />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-slate-700">{prod.nombre}</p>
                        <p className="max-w-[150px] truncate text-xs text-slate-500">{prod.descripcion}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      <DynamicIcon name={prod.categoria?.icono} />
                      {prod.categoria?.nombre}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">{formatCurrency(prod.precio)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${prod.stock < 10 ? "text-rose-600" : "text-slate-700"}`}>
                      {prod.stock} uds.
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1">
                      <IconButton label={`Editar ${prod.nombre}`} variant="primary" onClick={() => openEdit(prod)}>
                        <Edit size={18} />
                      </IconButton>
                      <IconButton label={`Eliminar ${prod.nombre}`} variant="danger" onClick={() => setDeleteTarget(prod)}>
                        <Trash2 size={18} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>

        {productosFiltrados.length > 0 && (
          <DataTablePagination
            page={currentPage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((prev) => prev - 1)}
            onNext={() => setCurrentPage((prev) => prev + 1)}
            info={<span>Página {currentPage} de {totalPages}</span>}
          />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar producto" : "Nuevo producto"}
        description="Completa los datos del producto."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="producto-form" loading={saving}>
              {editing ? "Actualizar" : "Guardar"}
            </Button>
          </>
        }
      >
        <form id="producto-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="prod-nombre" required>
              Nombre
            </Label>
            <Input
              id="prod-nombre"
              value={form.nombre}
              onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              error={Boolean(errors.nombre)}
              aria-describedby={errors.nombre ? "prod-nombre-error" : undefined}
              aria-required="true"
              autoComplete="off"
            />
            {errors.nombre && <FieldError id="prod-nombre-error">{errors.nombre}</FieldError>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="prod-precio" required>
                Precio (S/)
              </Label>
              <Input
                id="prod-precio"
                type="number"
                inputMode="decimal"
                step="0.10"
                min="0"
                value={form.precio}
                onChange={(event) => setForm({ ...form, precio: event.target.value })}
                error={Boolean(errors.precio)}
                aria-describedby={errors.precio ? "prod-precio-error" : undefined}
                aria-required="true"
              />
              {errors.precio && <FieldError id="prod-precio-error">{errors.precio}</FieldError>}
            </div>

            <div>
              <Label htmlFor="prod-categoria" required>
                Categoría
              </Label>
              <select
                id="prod-categoria"
                value={form.categoriaId}
                onChange={(event) => setForm({ ...form, categoriaId: event.target.value })}
                className={selectBase}
                aria-describedby={errors.categoriaId ? "prod-categoria-error" : undefined}
                aria-required="true"
              >
                <option value="">Selecciona una categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
              {errors.categoriaId && <FieldError id="prod-categoria-error">{errors.categoriaId}</FieldError>}
            </div>
          </div>

          <div>
            <Label htmlFor="prod-descripcion">Descripción</Label>
            <textarea
              id="prod-descripcion"
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
              className={`${selectBase} min-h-20 resize-none`}
            />
          </div>

          <div>
            <Label htmlFor="prod-imagen">URL de imagen</Label>
            <Input
              id="prod-imagen"
              type="url"
              inputMode="url"
              value={form.imagen_url}
              onChange={(event) => setForm({ ...form, imagen_url: event.target.value })}
              placeholder="https://..."
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="prod-stock">Stock actual</Label>
            <Input
              id="prod-stock"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.stock}
              onChange={(event) => setForm({ ...form, stock: event.target.value })}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar producto?"
        description={`Se quitará "${deleteTarget?.nombre ?? ""}" de la carta.`}
        confirmLabel="Sí, eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
