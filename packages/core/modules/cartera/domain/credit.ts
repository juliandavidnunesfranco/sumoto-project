// Crédito desembolsado: snapshot de condiciones al momento del desembolso
// (si el producto cambia después, este crédito conserva las suyas).

export type EstadoCredito = "activo" | "cancelado";

export interface Credito {
  id?: string;
  clienteId: string;
  tiendaId: string;
  montoDesembolsadoCentavos: number;
  tasaEA: number;
  tasaMoraEA: number;
  plazoMeses: number;
  cuotaCentavos: number;
  estado: EstadoCredito;
  desembolsadoEn: string; // ISO yyyy-mm-dd
}
