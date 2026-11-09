export interface SasiMenuObject {
  idObjeto: number;
  idPadre?: number | null;
  tipo?: string;
  nombre: string;
  url?: string;
  icono?: string | null;
  orden?: number;
  acciones?: string[];
}

export interface SasiRol {
  idRol?: number;
  nombreRol?: string;
  esPrincipal?: boolean;
  activo?: boolean;
  objetos?: SasiMenuObject[];
}

export interface SasiSistema {
  id: number;
  nombre?: string;
  activo?: boolean;
  roles?: SasiRol[];
}
