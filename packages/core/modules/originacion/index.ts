// ÚNICA puerta importable del módulo originacion (regla 2).

export type { ReporteRiesgo, VectorPago } from "./domain/risk-report";
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
  AlmacenDocumentos,
  DocumentoExpediente,
  MarcaVerificacion,
  RepositorioProductos,
  RepositorioSolicitudes,
  RepositorioVerificaciones,
} from "./domain/repositories";
export {
  CHECKLIST_DESEMBOLSO,
  esCodigoDeChecklist,
  evaluarVerificacion,
  PUNTAJE_MINIMO_VERIFICACION,
  type EstadoVerificacion,
  type ItemVerificacion,
} from "./domain/verificacion";
export { type ComandoMarcarVerificacion } from "./application/verify-disbursement";
export {
  EvaluarSolicitud,
  type ComandoEvaluarSolicitud,
  type SolicitudEvaluada,
} from "./application/evaluate-application";
export {
  OriginacionService,
  type ComandoSimularDecision,
  type ItemVerificado,
  type SolicitudParaDesembolso,
} from "./service";
export { moduloOriginacion } from "./module";
