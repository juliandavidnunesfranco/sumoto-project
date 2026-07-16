// ÚNICA puerta importable del módulo cartera (regla 2).

export type { Credito, EstadoCredito } from "./domain/credit";
export {
  capitalPendienteCentavos,
  estaSaldada,
  interesPendienteCentavos,
  type Cuota,
} from "./domain/installment";
export type { Pago } from "./domain/payment";
export { generarPlanDePagos } from "./domain/payment-plan";
export {
  moraPendienteCentavos,
  repartirPago,
  type AplicacionPago,
  type ComponentePago,
  type RepartoPago,
} from "./domain/payment-allocation";
export type {
  AcumuladosCuota,
  RepositorioCreditos,
  RepositorioPagos,
} from "./domain/repositories";
export {
  DesembolsarCredito,
  type ComandoDesembolsarCredito,
  type CreditoDesembolsado,
} from "./application/disburse-credit";
export {
  DesembolsarSolicitudAprobada,
  type ComandoDesembolsarSolicitud,
} from "./application/disburse-approved-application";
// el DTO SolicitudParaDesembolso público es el de originación (dueño del
// dato); este contrato es la vista local de cartera sobre esa forma.
export type { FuenteSolicitudesAprobadas } from "./domain/approved-application-source";
export {
  RegistrarPago,
  type ComandoRegistrarPago,
  type PagoRegistrado,
} from "./application/register-payment";
export { CarteraService } from "./service";
export { moduloCartera } from "./module";
