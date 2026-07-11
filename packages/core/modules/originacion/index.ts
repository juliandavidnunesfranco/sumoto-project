// ÚNICA puerta importable del módulo originacion (regla 2).

export type { ReporteRiesgo } from "./domain/risk-report";
export type { ConsultorRiesgo } from "./domain/risk-advisor";
export type {
  ProductoCredito,
  ReglasDecision,
} from "./domain/credit-product";
export {
  crearSolicitud,
  montoAFinanciarCentavos,
  type DatosSolicitud,
  type EstadoSolicitud,
  type Solicitud,
} from "./domain/loan-application";
export type { Decision, ResultadoDecision } from "./domain/decision";
export { decidirSolicitud } from "./domain/decision-engine";
export type {
  RepositorioProductos,
  RepositorioSolicitudes,
} from "./domain/repositories";
export {
  EvaluarSolicitud,
  type ComandoEvaluarSolicitud,
  type SolicitudEvaluada,
} from "./application/evaluate-application";
export { moduloOriginacion } from "./module";
