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
  RegistrarPago,
  type ComandoRegistrarPago,
  type PagoRegistrado,
} from "./application/register-payment";
export { CarteraService } from "./service";
export { moduloCartera } from "./module";
