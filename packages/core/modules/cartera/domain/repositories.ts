// Contratos de persistencia del módulo (DIP).

import type { Credito } from "./credit";
import type { Cuota } from "./installment";
import type { Pago } from "./payment";
import type { AplicacionPago } from "./payment-allocation";

export interface RepositorioCreditos {
  guardar(credito: Credito): Promise<Credito>;
  eliminar(creditoId: string): Promise<void>;
  buscarPorId(creditoId: string): Promise<Credito | null>;
  guardarCuotas(creditoId: string, cuotas: Cuota[]): Promise<Cuota[]>;
  eliminarCuotasDeCredito(creditoId: string): Promise<void>;
  cuotasDeCredito(creditoId: string): Promise<Cuota[]>;
  vincularSolicitud(solicitudId: string, creditoId: string): Promise<void>;
  desvincularSolicitud(solicitudId: string, creditoId: string): Promise<void>;
}

export interface AcumuladosCuota {
  capitalPagadoCentavos: number;
  interesPagadoCentavos: number;
  moraPagadaCentavos: number;
}

export interface RepositorioPagos {
  guardar(pago: Pago, aplicaciones: AplicacionPago[]): Promise<Pago>;
  actualizarAcumulados(cuotaId: string, acumulados: AcumuladosCuota): Promise<void>;
  // compensación del workflow de pago (borra también sus aplicaciones)
  eliminar(pagoId: string): Promise<void>;
}
