// Generación del plan de pagos (amortización francesa).
// USA LA MISMA cuotaMensualFrancesaCentavos que el motor de decisión de
// originación: la cuota prometida al cliente y la del plan coinciden al centavo.

import {
  cuotaMensualFrancesaCentavos,
  tasaMensualDesdeEA,
} from "../../../shared/finance";
import { agregarMeses } from "../../../shared/dates";
import type { Cuota } from "./installment";

export function generarPlanDePagos(params: {
  montoCentavos: number;
  tasaEA: number;
  plazoMeses: number;
  fechaDesembolso: string; // ISO; la cuota 1 vence un mes después
}): Cuota[] {
  const { montoCentavos, tasaEA, plazoMeses, fechaDesembolso } = params;
  const cuotaFija = cuotaMensualFrancesaCentavos(montoCentavos, tasaEA, plazoMeses);
  const i = tasaMensualDesdeEA(tasaEA);

  const cuotas: Cuota[] = [];
  let saldo = montoCentavos;

  for (let numero = 1; numero <= plazoMeses; numero++) {
    const interes = Math.round(saldo * i);
    // La última cuota absorbe el residuo de redondeo: amortiza EXACTO el saldo
    const capital = numero < plazoMeses ? cuotaFija - interes : saldo;
    saldo -= capital;

    cuotas.push({
      numero,
      fechaVencimiento: agregarMeses(fechaDesembolso, numero),
      capitalCentavos: capital,
      interesCentavos: interes,
      capitalPagadoCentavos: 0,
      interesPagadoCentavos: 0,
      moraPagadaCentavos: 0,
    });
  }

  if (saldo !== 0) {
    // Invariante del dominio: si esto pasa, hay un bug de redondeo — reventar
    throw new Error(`[cartera] el plan no amortiza el monto: saldo residual ${saldo}`);
  }
  return cuotas;
}
