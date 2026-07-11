// Producto de crédito con reglas de decisión parametrizables (viven en JSONB:
// cambiar la política de riesgo NO requiere deploy, solo actualizar el producto).

export interface ReglasDecision {
  scoreMinimo: number; // por debajo → NEGADO
  scoreRevision?: number; // entre mínimo y esto → REVISION_MANUAL
  cuotaMaximaPorcentajeIngreso: number; // fracción, ej 0.35
  ltvMaximo: number; // fracción del valor de la moto financiable, ej 0.90
  ingresoMinimoCentavos?: number;
  moraMaximaDias?: number; // mora reportada en buró por encima → NEGADO
}

export interface ProductoCredito {
  id: string;
  nombre: string;
  tasaEA: number; // fracción exacta, ej 0.245 = 24.5% EA
  plazoMinMeses: number;
  plazoMaxMeses: number;
  reglasDecision: ReglasDecision;
  activo: boolean;
}
