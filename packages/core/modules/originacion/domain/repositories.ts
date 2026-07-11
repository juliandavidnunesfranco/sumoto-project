// Contratos de persistencia del módulo (DIP).

import type { ProductoCredito } from "./credit-product";
import type { Decision } from "./decision";
import type { Solicitud } from "./loan-application";

export interface RepositorioProductos {
  buscarPorId(id: string): Promise<ProductoCredito | null>;
  listarActivos(): Promise<ProductoCredito[]>;
}

export interface RepositorioSolicitudes {
  guardar(solicitud: Solicitud): Promise<Solicitud>;
  guardarDecision(solicitudId: string, decision: Decision, reporteRiesgo: unknown): Promise<void>;
}
