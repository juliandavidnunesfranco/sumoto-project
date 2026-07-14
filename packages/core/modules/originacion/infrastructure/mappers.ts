// Traducción filas SQL (snake_case) ↔ dominio. El JSONB reglas_decision usa
// snake_case en la base y camelCase en el dominio: se traduce aquí.

import type { ProductoCredito, ReglasDecision } from "../domain/credit-product";
import type { EstadoSolicitud, Solicitud } from "../domain/loan-application";

export interface FilaProducto {
  id: string;
  nombre: string;
  tasa_ea: string | number; // numeric llega como string por PostgREST
  plazo_min_meses: number;
  plazo_max_meses: number;
  reglas_decision: ReglasDecisionJson;
  activo: boolean;
}

export interface ReglasDecisionJson {
  score_minimo: number;
  score_revision?: number;
  cuota_maxima_porcentaje_ingreso: number;
  ltv_maximo: number;
  ingreso_minimo_centavos?: number;
  mora_maxima_dias?: number;
}

export function aFilaReglasJson(r: ReglasDecision): ReglasDecisionJson {
  return {
    score_minimo: r.scoreMinimo,
    score_revision: r.scoreRevision,
    cuota_maxima_porcentaje_ingreso: r.cuotaMaximaPorcentajeIngreso,
    ltv_maximo: r.ltvMaximo,
    ingreso_minimo_centavos: r.ingresoMinimoCentavos,
    mora_maxima_dias: r.moraMaximaDias,
  };
}

export function aFilaProductoNueva(p: Omit<ProductoCredito, "id">): Omit<FilaProducto, "id"> {
  return {
    nombre: p.nombre,
    tasa_ea: p.tasaEA,
    plazo_min_meses: p.plazoMinMeses,
    plazo_max_meses: p.plazoMaxMeses,
    reglas_decision: aFilaReglasJson(p.reglasDecision),
    activo: p.activo,
  };
}

export function aProducto(fila: FilaProducto): ProductoCredito {
  const r = fila.reglas_decision;
  const reglas: ReglasDecision = {
    scoreMinimo: r.score_minimo,
    scoreRevision: r.score_revision,
    cuotaMaximaPorcentajeIngreso: r.cuota_maxima_porcentaje_ingreso,
    ltvMaximo: r.ltv_maximo,
    ingresoMinimoCentavos: r.ingreso_minimo_centavos,
    moraMaximaDias: r.mora_maxima_dias,
  };
  return {
    id: fila.id,
    nombre: fila.nombre,
    tasaEA: Number(fila.tasa_ea),
    plazoMinMeses: fila.plazo_min_meses,
    plazoMaxMeses: fila.plazo_max_meses,
    reglasDecision: reglas,
    activo: fila.activo,
  };
}

export interface FilaSolicitud {
  id: string;
  cliente_id: string;
  producto_id: string;
  moto_id: string;
  tienda_id: string;
  creado_por: string;
  valor_moto_centavos: number;
  cuota_inicial_centavos: number;
  cargos_adicionales_centavos: number;
  plazo_meses: number;
  ingresos_declarados_centavos: number;
  estado: EstadoSolicitud;
}

export function aSolicitud(fila: FilaSolicitud): Solicitud {
  return {
    id: fila.id,
    clienteId: fila.cliente_id,
    productoId: fila.producto_id,
    motoId: fila.moto_id,
    tiendaId: fila.tienda_id,
    creadoPor: fila.creado_por,
    valorMotoCentavos: Number(fila.valor_moto_centavos),
    cuotaInicialCentavos: Number(fila.cuota_inicial_centavos),
    cargosAdicionalesCentavos: Number(fila.cargos_adicionales_centavos),
    plazoMeses: fila.plazo_meses,
    ingresosDeclaradosCentavos: Number(fila.ingresos_declarados_centavos),
    estado: fila.estado,
  };
}

export function aFilaSolicitudNueva(s: Solicitud): Omit<FilaSolicitud, "id"> {
  return {
    cliente_id: s.clienteId,
    producto_id: s.productoId,
    moto_id: s.motoId,
    tienda_id: s.tiendaId,
    creado_por: s.creadoPor,
    valor_moto_centavos: s.valorMotoCentavos,
    cuota_inicial_centavos: s.cuotaInicialCentavos,
    cargos_adicionales_centavos: s.cargosAdicionalesCentavos ?? 0,
    plazo_meses: s.plazoMeses,
    ingresos_declarados_centavos: s.ingresosDeclaradosCentavos,
    estado: s.estado,
  };
}
