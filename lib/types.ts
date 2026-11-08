export interface SasiMenuObject {
  idObjeto: number;
  idPadre?: number | null;
  tipo?: string;
  nombre: string;
  url?: string;
  icono?: string | null;
  orden?: number;
}

export interface SasiRol {
  nombreRol?: string;
  esPrincipal?: boolean;
  objetos?: SasiMenuObject[];
}

export interface SasiSistema {
  id: number;
  roles?: SasiRol[];
}
