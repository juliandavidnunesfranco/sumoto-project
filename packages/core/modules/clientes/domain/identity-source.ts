// Contrato de captura de identidad (ISP: una sola operación).
// Cada fuente traduce SU formato crudo (JSON del escáner, formulario web) a
// DatosCiudadano — el formato externo muere en la implementación (regla 5).

import type { Resultado } from "../../../kernel/result";
import type { DatosCiudadano, FuenteDeDatos } from "./citizen-data";

export interface FuenteIdentidad {
  readonly nombre: FuenteDeDatos;
  capturar(entradaCruda: unknown): Promise<Resultado<DatosCiudadano, string>>;
}
