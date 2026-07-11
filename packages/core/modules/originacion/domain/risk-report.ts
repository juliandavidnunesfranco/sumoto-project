// El reporte de riesgo YA traducido al dominio. El JSON crudo de Experian
// (o quien sea) muere en el adaptador de integrations/experian (regla 5).

export interface ReporteRiesgo {
  cedula: string;
  score: number; // 150–950 (escala tipo buró)
  moraMaximaDiasUltimos12Meses: number;
  endeudamientoCentavos: number; // deuda vigente reportada
  consultadoEn: string; // ISO
}
