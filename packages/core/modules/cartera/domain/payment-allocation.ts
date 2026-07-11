// Reparto de pagos: mora → interés → capital, cuota más antigua primero.
// Un pago puede cubrir varias cuotas; lo que no alcance queda como sobrante
// (decisión de negocio sobre el sobrante: la toma el caso de uso, no este servicio).

import { diasEntre } from "../../../shared/dates";
import { tasaDiariaDesdeEA } from "../../../shared/finance";
import {
  capitalPendienteCentavos,
  interesPendienteCentavos,
  type Cuota,
} from "./installment";

export type ComponentePago = "mora" | "interes" | "capital";

export interface AplicacionPago {
  cuotaNumero: number;
  cuotaId?: string;
  componente: ComponentePago;
  montoCentavos: number;
}

export interface RepartoPago {
  aplicaciones: AplicacionPago[];
  sobranteCentavos: number;
}

// Mora devengada de una cuota: interés diario sobre el CAPITAL pendiente
// por los días vencidos, menos la mora ya pagada.
export function moraPendienteCentavos(
  cuota: Cuota,
  fechaPago: string,
  tasaMoraEA: number,
): number {
  const dias = Math.max(0, diasEntre(cuota.fechaVencimiento, fechaPago));
  if (dias === 0) return 0;
  const devengada = Math.round(
    capitalPendienteCentavos(cuota) * tasaDiariaDesdeEA(tasaMoraEA) * dias,
  );
  return Math.max(0, devengada - cuota.moraPagadaCentavos);
}

export function repartirPago(params: {
  montoCentavos: number;
  cuotas: Cuota[]; // el plan completo o las pendientes; se ordena aquí
  fechaPago: string; // ISO
  tasaMoraEA: number;
}): RepartoPago {
  const { montoCentavos, cuotas, fechaPago, tasaMoraEA } = params;
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) {
    throw new Error(`[cartera] monto de pago inválido: ${montoCentavos}`);
  }

  const ordenadas = [...cuotas].sort((a, b) => a.numero - b.numero);
  const aplicaciones: AplicacionPago[] = [];
  let disponible = montoCentavos;

  for (const cuota of ordenadas) {
    if (disponible === 0) break;

    const pendientes: Array<[ComponentePago, number]> = [
      ["mora", moraPendienteCentavos(cuota, fechaPago, tasaMoraEA)],
      ["interes", interesPendienteCentavos(cuota)],
      ["capital", capitalPendienteCentavos(cuota)],
    ];

    for (const [componente, pendiente] of pendientes) {
      if (disponible === 0) break;
      if (pendiente <= 0) continue;

      const aplicado = Math.min(disponible, pendiente);
      disponible -= aplicado;
      aplicaciones.push({
        cuotaNumero: cuota.numero,
        cuotaId: cuota.id,
        componente,
        montoCentavos: aplicado,
      });
    }
  }

  return { aplicaciones, sobranteCentavos: disponible };
}
