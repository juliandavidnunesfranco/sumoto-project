// ÚNICA puerta importable del módulo originacion (regla 2).

export type { ReporteRiesgo } from "./domain/risk-report";
export type { ConsultorRiesgo } from "./domain/risk-advisor";
export {
  crearProducto,
  validarProducto,
  validarReglasDecision,
  type DatosProducto,
  type ProductoCredito,
  type ReglasDecision,
} from "./domain/credit-product";
export {
  crearSolicitud,
  montoAFinanciarCentavos,
  type DatosSolicitud,
  type EstadoSolicitud,
  type Solicitud,
} from "./domain/loan-application";
export type { Decision, ResultadoDecision } from "./domain/decision";
export {
  decidirSolicitud,
  MotorDecisionV1,
  type MotorDecision,
} from "./domain/decision-engine";
export type {
  RepositorioProductos,
  RepositorioSolicitudes,
} from "./domain/repositories";
export {
  EvaluarSolicitud,
  type ComandoEvaluarSolicitud,
  type SolicitudEvaluada,
} from "./application/evaluate-application";
export {
  OriginacionService,
  type ComandoSimularDecision,
} from "./service";
export { moduloOriginacion } from "./module";
