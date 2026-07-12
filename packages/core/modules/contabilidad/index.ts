// ÚNICA puerta importable del módulo contabilidad (regla 2).

export {
  CUENTAS,
  crearAsiento,
  credito,
  debito,
  type AsientoContable,
  type Partida,
} from "./domain/journal-entry";
export {
  asientoDeDesembolso,
  asientoDePago,
  type HechoDesembolso,
  type HechoPago,
} from "./domain/entry-templates";
export type { SistemaContable } from "./domain/accounting-system";
export type {
  EstadoDespacho,
  RepositorioAsientos,
} from "./domain/repositories";
export { RegistrarAsiento } from "./application/record-entry";
export { ContabilidadService } from "./service";
export { moduloContabilidad } from "./module";
