// Fachada del módulo (patrón Medusa v2) — token modulo.catalogo.service.
// Solo lectura desde la app: buscar/listar motos con paginación.

import type { OpcionesBusquedaMotos, RepositorioMotos } from "./domain/repository";

export class CatalogoService {
  constructor(private readonly repositorio: RepositorioMotos) {}

  buscarMotos(opciones: OpcionesBusquedaMotos) {
    return this.repositorio.buscar(opciones);
  }

  buscarMotoPorId(id: string) {
    return this.repositorio.buscarPorId(id);
  }
}
