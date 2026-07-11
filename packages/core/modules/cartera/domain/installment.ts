// Cuota del plan de pagos. La mora NO se almacena: se devenga por días
// vencidos al momento de calcular (solo se guarda cuánta mora se ha pagado).

export interface Cuota {
  id?: string;
  creditoId?: string;
  numero: number;
  fechaVencimiento: string; // ISO yyyy-mm-dd
  capitalCentavos: number;
  interesCentavos: number;
  capitalPagadoCentavos: number;
  interesPagadoCentavos: number;
  moraPagadaCentavos: number;
}

export function capitalPendienteCentavos(cuota: Cuota): number {
  return cuota.capitalCentavos - cuota.capitalPagadoCentavos;
}

export function interesPendienteCentavos(cuota: Cuota): number {
  return cuota.interesCentavos - cuota.interesPagadoCentavos;
}

export function estaSaldada(cuota: Cuota): boolean {
  return capitalPendienteCentavos(cuota) === 0 && interesPendienteCentavos(cuota) === 0;
}
