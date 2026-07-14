import type { Moto } from "./moto";

export interface ResultadoPaginado<T> {
  items: T[];
  total: number;
}

export interface OpcionesBusquedaMotos {
  query?: string;
  pagina: number;
  porPagina: number;
}

export interface RepositorioMotos {
  buscar(opciones: OpcionesBusquedaMotos): Promise<ResultadoPaginado<Moto>>;
  buscarPorId(id: string): Promise<Moto | null>;
}
