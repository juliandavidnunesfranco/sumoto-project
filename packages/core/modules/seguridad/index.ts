// ÚNICA puerta importable del módulo seguridad (regla 2).

export {
  esRolDeTienda,
  type Perfil,
  type RepositorioPerfiles,
  type Rol,
} from "./domain/profile";
export { SeguridadService } from "./service";
export { moduloSeguridad } from "./module";
