// ÚNICA puerta importable del módulo catalogo (regla 2).

export type { Moto } from "./domain/moto";
export type {
  OpcionesBusquedaMotos,
  RepositorioMotos,
  ResultadoPaginado,
} from "./domain/repository";
export { CatalogoService } from "./service";
export { moduloCatalogo } from "./module";
