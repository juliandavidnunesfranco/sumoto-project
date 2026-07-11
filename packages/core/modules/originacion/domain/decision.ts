// La decisión del motor: resultado + razones SIEMPRE visibles
// (explicabilidad = requisito del negocio, para aprobar y para negar).

export type ResultadoDecision = "APROBADO" | "NEGADO" | "REVISION_MANUAL";

export interface Decision {
  resultado: ResultadoDecision;
  razones: string[];
  score: number;
  cuotaEstimadaCentavos: number;
}
