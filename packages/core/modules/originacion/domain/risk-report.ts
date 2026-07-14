// El reporte de riesgo YA traducido al dominio. El JSON crudo de Experian
// (o quien sea) muere en el adaptador de integrations/experian (regla 5).

// Una línea de crédito vigente tal como la reporta el buró (lo que en la
// jerga del negocio se llama "vector de pago").
export interface VectorPago {
  entidad: string;
  tipoProducto: string;
  saldoCentavos: number;
  diasMora: number;
}

export interface ReporteRiesgo {
  cedula: string;
  score: number; // 150–950 (escala tipo buró)
  moraMaximaDiasUltimos12Meses: number;
  endeudamientoCentavos: number; // deuda vigente reportada
  reportesNegativos: boolean;
  vectoresPago: VectorPago[];
  consultadoEn: string; // ISO
}
