// ÚNICA puerta importable del módulo clientes (regla 2).

export type { DatosCiudadano, FuenteDeDatos } from "./domain/citizen-data";
export {
  crearCliente,
  validarParaRegistro,
  type Cliente,
  type DatosRegistro,
} from "./domain/client";
export type { FuenteIdentidad } from "./domain/identity-source";
export type { RepositorioClientes } from "./domain/client-repository";
export {
  RegistrarCliente,
  type ComandoRegistrarCliente,
} from "./application/register-client";
export { moduloClientes } from "./module";
