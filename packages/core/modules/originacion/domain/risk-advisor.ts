// Contrato del consultor de riesgo (ISP: una operación).
// Implementaciones: ExperianMock hoy, Experian real mañana — token DI integracion.riesgo.

import type { Resultado } from "../../../kernel/result";
import type { ReporteRiesgo } from "./risk-report";

export interface ConsultorRiesgo {
  consultar(cedula: string): Promise<Resultado<ReporteRiesgo, string>>;
}
