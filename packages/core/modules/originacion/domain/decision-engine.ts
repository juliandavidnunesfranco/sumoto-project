// Motor de decisión: servicio de dominio puro y determinista.
// Evalúa TODAS las políticas del producto (no corta en la primera falla) para
// que la decisión sea explicable completa. Prioridad: NEGADO > REVISION_MANUAL
// > APROBADO — una sola causal de negación niega, sin importar las demás.
//
// El contrato MotorDecision permite intercambiar el motor por container
// (motor v2, ML, o un "motor sombra" que corre ambos y compara) sin tocar
// el caso de uso — token DI: modulo.originacion.motorDecision.

import { cuotaMensualFrancesaCentavos } from "../../../shared/finance";
import type { ProductoCredito } from "./credit-product";
import type { Decision, ResultadoDecision } from "./decision";
import {
  montoAFinanciarCentavos,
  type Solicitud,
} from "./loan-application";
import type { ReporteRiesgo } from "./risk-report";

export interface MotorDecision {
  decidir(
    solicitud: Solicitud,
    producto: ProductoCredito,
    reporte: ReporteRiesgo,
  ): Decision;
}

// Implementación v1: reglas paramétricas del producto.
export class MotorDecisionV1 implements MotorDecision {
  decidir(
    solicitud: Solicitud,
    producto: ProductoCredito,
    reporte: ReporteRiesgo,
  ): Decision {
    return decidirSolicitud(solicitud, producto, reporte);
  }
}

export function decidirSolicitud(
  solicitud: Solicitud,
  producto: ProductoCredito,
  reporte: ReporteRiesgo,
): Decision {
  const reglas = producto.reglasDecision;
  const razones: string[] = [];
  let negado = false;
  let revision = false;

  const monto = montoAFinanciarCentavos(solicitud);
  const cuota = cuotaMensualFrancesaCentavos(
    monto,
    producto.tasaEA,
    solicitud.plazoMeses,
  );

  // 1. Ingreso mínimo del producto
  if (reglas.ingresoMinimoCentavos !== undefined) {
    if (solicitud.ingresosDeclaradosCentavos < reglas.ingresoMinimoCentavos) {
      negado = true;
      razones.push(
        `ingresos ${enPesos(solicitud.ingresosDeclaradosCentavos)} por debajo del mínimo del producto ${enPesos(reglas.ingresoMinimoCentavos)}`,
      );
    } else {
      razones.push(`ingresos cumplen el mínimo del producto`);
    }
  }

  // 2. Score de buró
  if (reporte.score < reglas.scoreMinimo) {
    negado = true;
    razones.push(
      `score ${reporte.score} por debajo del mínimo ${reglas.scoreMinimo}`,
    );
  } else if (
    reglas.scoreRevision !== undefined &&
    reporte.score < reglas.scoreRevision
  ) {
    revision = true;
    razones.push(
      `score ${reporte.score} en zona de revisión (${reglas.scoreMinimo}–${reglas.scoreRevision})`,
    );
  } else {
    razones.push(`score ${reporte.score} supera el mínimo ${reglas.scoreMinimo}`);
  }

  // 3. Mora reportada en buró
  if (reglas.moraMaximaDias !== undefined) {
    if (reporte.moraMaximaDiasUltimos12Meses > reglas.moraMaximaDias) {
      negado = true;
      razones.push(
        `mora de ${reporte.moraMaximaDiasUltimos12Meses} días en los últimos 12 meses supera el máximo tolerado (${reglas.moraMaximaDias})`,
      );
    } else {
      razones.push(
        `sin moras relevantes en buró (máxima: ${reporte.moraMaximaDiasUltimos12Meses} días)`,
      );
    }
  }

  // 4. Capacidad de pago: cuota / ingreso. Comparación contra umbral (fracción),
  // no aritmética de dinero: el float del porcentaje es aceptable aquí.
  const porcentajeIngreso = cuota / solicitud.ingresosDeclaradosCentavos;
  if (porcentajeIngreso > reglas.cuotaMaximaPorcentajeIngreso) {
    negado = true;
    razones.push(
      `la cuota ${enPesos(cuota)} representa ${enPorcentaje(porcentajeIngreso)} del ingreso, sobre el máximo ${enPorcentaje(reglas.cuotaMaximaPorcentajeIngreso)}`,
    );
  } else {
    razones.push(
      `cuota ${enPesos(cuota)} = ${enPorcentaje(porcentajeIngreso)} del ingreso (máximo ${enPorcentaje(reglas.cuotaMaximaPorcentajeIngreso)})`,
    );
  }

  // 5. LTV: porción del valor de la moto que se financia
  const ltv = monto / solicitud.valorMotoCentavos;
  if (ltv > reglas.ltvMaximo) {
    negado = true;
    razones.push(
      `LTV ${enPorcentaje(ltv)} supera el máximo ${enPorcentaje(reglas.ltvMaximo)}: falta cuota inicial`,
    );
  } else {
    razones.push(`LTV ${enPorcentaje(ltv)} dentro del máximo ${enPorcentaje(reglas.ltvMaximo)}`);
  }

  const resultado: ResultadoDecision = negado
    ? "NEGADO"
    : revision
      ? "REVISION_MANUAL"
      : "APROBADO";

  return { resultado, razones, score: reporte.score, cuotaEstimadaCentavos: cuota };
}

function enPesos(centavos: number): string {
  return `$${Math.round(centavos / 100).toLocaleString("es-CO")}`;
}

function enPorcentaje(fraccion: number): string {
  return `${(fraccion * 100).toFixed(1)}%`;
}
