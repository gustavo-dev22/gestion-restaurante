export type PermissionCode =
  | "audit:read"
  | "audit:export"
  | "roles:manage"
  | "payments:create"
  | "payments:conciliate"
  | "payments:refund"
  | "payments:void"
  | "payments:discount"
  | "caja:open"
  | "caja:close"
  | "caja:movements"
  | "products:manage"
  | "stock:adjust"
  | "tables:manage"
  | "reservations:manage"
  | "orders:accept"
  | "orders:cancel"
  | "orders:prepare"
  | "orders:serve"
  | "inventory:read"
  | "inventory:manage"
  | "inventory:waste"
  | "inventory:count"
  | "inventory:transfer"
  | "inventory:purchase"
  | "costs:read"
  | "reports:read"
  | "reports:export";

export interface PermissionDefinition {
  codigo: PermissionCode;
  nombre: string;
  grupo: string;
  descripcion: string;
}

export interface RoleDefinition {
  codigo: string;
  nombre: string;
  descripcion: string;
  permisos: PermissionCode[];
}

export const PERMISSIONS: readonly PermissionDefinition[] = [
  {
    codigo: "audit:read",
    nombre: "Ver auditoría",
    grupo: "Auditoría",
    descripcion: "Consultar el registro de auditoría.",
  },
  {
    codigo: "audit:export",
    nombre: "Exportar auditoría",
    grupo: "Auditoría",
    descripcion: "Descargar el registro de auditoría en CSV.",
  },
  {
    codigo: "roles:manage",
    nombre: "Gestionar roles y permisos",
    grupo: "Seguridad",
    descripcion: "Asignar roles locales y modificar la matriz de permisos.",
  },
  {
    codigo: "payments:create",
    nombre: "Registrar pagos",
    grupo: "Cobros",
    descripcion: "Registrar pagos parciales o completos.",
  },
  {
    codigo: "payments:conciliate",
    nombre: "Conciliar pagos",
    grupo: "Cobros",
    descripcion: "Conciliar pagos y devoluciones electrónicas.",
  },
  {
    codigo: "payments:refund",
    nombre: "Registrar devoluciones",
    grupo: "Cobros",
    descripcion: "Registrar devoluciones de pagos y reponer stock.",
  },
  {
    codigo: "payments:void",
    nombre: "Anular pagos",
    grupo: "Cobros",
    descripcion: "Anular pagos del turno actual con motivo.",
  },
  {
    codigo: "payments:discount",
    nombre: "Aplicar descuentos",
    grupo: "Cobros",
    descripcion: "Aplicar descuentos y cupones a una cuenta.",
  },
  {
    codigo: "caja:open",
    nombre: "Abrir caja",
    grupo: "Caja",
    descripcion: "Abrir un turno de caja con fondo inicial.",
  },
  {
    codigo: "caja:close",
    nombre: "Cerrar caja",
    grupo: "Caja",
    descripcion: "Cerrar el turno y registrar el arqueo.",
  },
  {
    codigo: "caja:movements",
    nombre: "Movimientos de caja",
    grupo: "Caja",
    descripcion: "Registrar ingresos, retiros o gastos de caja.",
  },
  {
    codigo: "products:manage",
    nombre: "Gestionar carta",
    grupo: "Carta",
    descripcion: "Crear, editar y desactivar productos y categorías.",
  },
  {
    codigo: "stock:adjust",
    nombre: "Ajustar inventario",
    grupo: "Stock",
    descripcion: "Cambiar la disponibilidad de productos.",
  },
  {
    codigo: "tables:manage",
    nombre: "Gestionar mesas",
    grupo: "Salón",
    descripcion: "Crear, editar y desactivar mesas.",
  },
  {
    codigo: "reservations:manage",
    nombre: "Gestionar reservas",
    grupo: "Reservas",
    descripcion: "Actualizar el estado de las reservas.",
  },
  {
    codigo: "orders:accept",
    nombre: "Aceptar pedidos QR",
    grupo: "Pedidos",
    descripcion: "Asignar y confirmar pedidos creados por clientes.",
  },
  {
    codigo: "orders:cancel",
    nombre: "Cancelar pedidos",
    grupo: "Pedidos",
    descripcion: "Cancelar pedidos sin consumo y liberar la mesa.",
  },
  {
    codigo: "orders:prepare",
    nombre: "Iniciar preparación",
    grupo: "Pedidos",
    descripcion: "Iniciar y completar la preparación de platos.",
  },
  {
    codigo: "orders:serve",
    nombre: "Servir y atender mesas",
    grupo: "Pedidos",
    descripcion: "Marcar pedidos servidos y atender llamados.",
  },
  {
    codigo: "inventory:read",
    nombre: "Ver inventario",
    grupo: "Inventario",
    descripcion: "Consultar insumos, recetas y stock.",
  },
  {
    codigo: "inventory:manage",
    nombre: "Gestionar inventario",
    grupo: "Inventario",
    descripcion: "Crear insumos y recetas.",
  },
  {
    codigo: "inventory:waste",
    nombre: "Registrar merma",
    grupo: "Inventario",
    descripcion: "Registrar pérdidas con motivo y responsable.",
  },
  {
    codigo: "inventory:count",
    nombre: "Realizar conteo",
    grupo: "Inventario",
    descripcion: "Registrar conteos físicos y ajustes.",
  },
  {
    codigo: "inventory:transfer",
    nombre: "Transferir stock",
    grupo: "Inventario",
    descripcion: "Mover insumos entre almacenes.",
  },
  {
    codigo: "inventory:purchase",
    nombre: "Registrar compra",
    grupo: "Inventario",
    descripcion: "Registrar entradas de insumos y costos.",
  },
  {
    codigo: "costs:read",
    nombre: "Ver costos reales",
    grupo: "Inventario",
    descripcion: "Consultar costos y márgenes reales.",
  },
  {
    codigo: "reports:read",
    nombre: "Ver reportes",
    grupo: "Reportes",
    descripcion: "Consultar los reportes operativos.",
  },
  {
    codigo: "reports:export",
    nombre: "Exportar reportes",
    grupo: "Reportes",
    descripcion: "Descargar reportes en CSV.",
  },
];

const ALL_PERMISSIONS = PERMISSIONS.map((permiso) => permiso.codigo);

const SUPERVISOR_PERMISSIONS = ALL_PERMISSIONS.filter(
  (codigo) => codigo !== "roles:manage" && codigo !== "audit:export"
);

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    codigo: "ADMIN",
    nombre: "Administrador",
    descripcion: "Acceso completo a la operación, seguridad y auditoría.",
    permisos: [...ALL_PERMISSIONS],
  },
  {
    codigo: "SUPERVISOR",
    nombre: "Supervisor",
    descripcion: "Operación, aprobaciones y lectura de auditoría.",
    permisos: [...SUPERVISOR_PERMISSIONS],
  },
  {
    codigo: "CAJERO",
    nombre: "Cajero",
    descripcion: "Cobros, caja, conciliación y cierre.",
    permisos: [
      "payments:create",
      "payments:conciliate",
      "caja:open",
      "caja:close",
      "caja:movements",
      "reports:read",
    ],
  },
  {
    codigo: "MESERO",
    nombre: "Mesero",
    descripcion: "Pedidos, aceptación de QR y cobro del saldo completo.",
    permisos: ["orders:accept", "orders:cancel", "orders:serve", "payments:create"],
  },
  {
    codigo: "COCINA",
    nombre: "Cocina / Bar",
    descripcion: "Comandas y ajuste de disponibilidad de productos.",
    permisos: [
      "stock:adjust",
      "orders:prepare",
      "inventory:read",
      "inventory:waste",
      "inventory:count",
      "inventory:transfer",
    ],
  },
  {
    codigo: "AUDITOR",
    nombre: "Auditor",
    descripcion: "Consulta y exportación de auditoría y reportes.",
    permisos: ["audit:read", "audit:export", "reports:read", "reports:export"],
  },
];

export const PERMISSION_GROUPS = [
  "Auditoría",
  "Seguridad",
  "Cobros",
  "Caja",
  "Carta",
  "Inventario",
  "Stock",
  "Salón",
  "Reservas",
  "Pedidos",
  "Reportes",
] as const;

const permissionCodes = new Set<string>(ALL_PERMISSIONS);

export function isPermissionCode(value: string): value is PermissionCode {
  return permissionCodes.has(value);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function mapSasiRoleToLocal(rolSasi: string | null | undefined): string | null {
  const rol = normalize(rolSasi ?? "");
  if (!rol) return null;
  if (/(admin|administrador|gerente|dueno)/.test(rol)) return "ADMIN";
  if (/supervisor/.test(rol)) return "SUPERVISOR";
  if (/(cajero|cajera|caja|tesorer)/.test(rol)) return "CAJERO";
  if (/(mesero|mesera|waiter|salon)/.test(rol)) return "MESERO";
  if (/(cocina|chef|cocinero|cocinera|bar|bebidas|postres)/.test(rol)) return "COCINA";
  if (/(auditor|auditora|auditoria)/.test(rol)) return "AUDITOR";
  return null;
}
