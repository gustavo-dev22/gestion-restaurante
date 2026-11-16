export interface RbacPermissionDto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  grupo: string;
}

export interface RbacRoleDto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  permisos: string[];
}

export interface RbacUserDto {
  id: number;
  sasiSub: string;
  nombre: string;
  email: string | null;
  rolSasi: string | null;
  activo: boolean;
  roles: Array<{ id: number; codigo: string; nombre: string }>;
}

export interface RbacDataDto {
  roles: RbacRoleDto[];
  permisos: RbacPermissionDto[];
  usuarios: RbacUserDto[];
}
