// Producto de crédito con reglas de decisión parametrizables (viven en JSONB:
// cambiar la política de riesgo NO requiere deploy, solo actualizar el producto).

import { exito, fallo, type Resultado } from "../../../kernel/result";

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

export interface DatosProducto {
  nombre: string;
  tasaEA: number;
  plazoMinMeses: number;
  plazoMaxMeses: number;
  reglasDecision: ReglasDecision;
}

// Score escala Experian (150-950), consistente con el mock del adaptador.
const SCORE_MIN = 150;
const SCORE_MAX = 950;

// Predicados puros: única fuente de verdad, reutilizables por schemas Zod.
export function validarReglasDecision(reglas: ReglasDecision): string[] {
  const violaciones: string[] = [];

  if (reglas.scoreMinimo < SCORE_MIN || reglas.scoreMinimo > SCORE_MAX) {
    violaciones.push(`el score mínimo debe estar entre ${SCORE_MIN} y ${SCORE_MAX}`);
  }
  if (reglas.scoreRevision !== undefined) {
    if (reglas.scoreRevision < reglas.scoreMinimo || reglas.scoreRevision > SCORE_MAX) {
      violaciones.push("el score de revisión debe ser mayor o igual al mínimo y hasta 950");
    }
  }
  if (reglas.cuotaMaximaPorcentajeIngreso <= 0 || reglas.cuotaMaximaPorcentajeIngreso > 1) {
    violaciones.push("la cuota máxima como porcentaje del ingreso debe estar entre 0% y 100%");
  }
  if (reglas.ltvMaximo <= 0 || reglas.ltvMaximo > 1) {
    violaciones.push("el LTV máximo debe estar entre 0% y 100%");
  }
  if (
    reglas.ingresoMinimoCentavos !== undefined &&
    (!Number.isInteger(reglas.ingresoMinimoCentavos) || reglas.ingresoMinimoCentavos < 0)
  ) {
    violaciones.push("el ingreso mínimo debe ser un entero en centavos, cero o más");
  }
  if (
    reglas.moraMaximaDias !== undefined &&
    (!Number.isInteger(reglas.moraMaximaDias) || reglas.moraMaximaDias < 0)
  ) {
    violaciones.push("la mora máxima tolerada debe ser un entero de días, cero o más");
  }

  return violaciones;
}

export function validarProducto(datos: DatosProducto): string[] {
  const violaciones: string[] = [];

  if (datos.nombre.trim() === "") {
    violaciones.push("el nombre del producto es obligatorio");
  }
  if (!Number.isFinite(datos.tasaEA) || datos.tasaEA < 0 || datos.tasaEA >= 2) {
    violaciones.push("la tasa EA debe ser una fracción entre 0 y 2 (200%)");
  }
  if (!Number.isInteger(datos.plazoMinMeses) || datos.plazoMinMeses <= 0) {
    violaciones.push("el plazo mínimo debe ser un entero de meses mayor a cero");
  }
  if (!Number.isInteger(datos.plazoMaxMeses) || datos.plazoMaxMeses < datos.plazoMinMeses) {
    violaciones.push("el plazo máximo debe ser un entero mayor o igual al plazo mínimo");
  }
  violaciones.push(...validarReglasDecision(datos.reglasDecision));

  return violaciones;
}

// Única fábrica del producto nuevo (sin persistir aún).
export function crearProducto(
  datos: DatosProducto,
): Resultado<Omit<ProductoCredito, "id">, string[]> {
  const violaciones = validarProducto(datos);
  if (violaciones.length > 0) return fallo(violaciones);
  return exito({ ...datos, activo: true });
}

// Reemplaza las reglas de un producto existente, revalidando.
export function actualizarReglas(
  producto: ProductoCredito,
  reglasNuevas: ReglasDecision,
): Resultado<ProductoCredito, string[]> {
  const violaciones = validarReglasDecision(reglasNuevas);
  if (violaciones.length > 0) return fallo(violaciones);
  return exito({ ...producto, reglasDecision: reglasNuevas });
}
