import { describe, expect, it } from "vitest";
import {
  actualizarReglas,
  crearProducto,
  validarProducto,
  validarReglasDecision,
  type DatosProducto,
  type ProductoCredito,
  type ReglasDecision,
} from "./credit-product";

const REGLAS_OK: ReglasDecision = {
  scoreMinimo: 600,
  scoreRevision: 650,
  cuotaMaximaPorcentajeIngreso: 0.35,
  ltvMaximo: 0.9,
};

const DATOS_OK: DatosProducto = {
  nombre: "Moto Fácil",
  tasaEA: 0.245,
  plazoMinMeses: 6,
  plazoMaxMeses: 36,
  reglasDecision: REGLAS_OK,
};

describe("validarReglasDecision", () => {
  it("acepta reglas dentro de rango", () => {
    expect(validarReglasDecision(REGLAS_OK)).toEqual([]);
  });

  it("rechaza score mínimo fuera de la escala Experian (150-950)", () => {
    const { scoreRevision: _, ...sinRevision } = REGLAS_OK;
    expect(validarReglasDecision({ ...sinRevision, scoreMinimo: 100 })).toHaveLength(1);
    expect(validarReglasDecision({ ...sinRevision, scoreMinimo: 1000 })).toHaveLength(1);
  });

  it("rechaza score de revisión menor al mínimo", () => {
    const violaciones = validarReglasDecision({ ...REGLAS_OK, scoreRevision: 500 });
    expect(violaciones).toHaveLength(1);
  });

  it("rechaza porcentajes fuera de (0, 1]", () => {
    expect(
      validarReglasDecision({ ...REGLAS_OK, cuotaMaximaPorcentajeIngreso: 0 }),
    ).toHaveLength(1);
    expect(validarReglasDecision({ ...REGLAS_OK, ltvMaximo: 1.5 })).toHaveLength(1);
  });

  it("rechaza ingreso mínimo o mora con decimales o negativos", () => {
    const violaciones = validarReglasDecision({
      ...REGLAS_OK,
      ingresoMinimoCentavos: -1,
      moraMaximaDias: 5.5,
    });
    expect(violaciones).toHaveLength(2);
  });
});

describe("validarProducto / crearProducto", () => {
  it("acepta datos completos y válidos", () => {
    expect(validarProducto(DATOS_OK)).toEqual([]);
    const resultado = crearProducto(DATOS_OK);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.activo).toBe(true);
    }
  });

  it("acumula TODAS las violaciones, no solo la primera", () => {
    const violaciones = validarProducto({
      nombre: " ",
      tasaEA: -1,
      plazoMinMeses: 0,
      plazoMaxMeses: -5,
      reglasDecision: { ...REGLAS_OK, scoreMinimo: 100 },
    });
    expect(violaciones).toHaveLength(5);
  });

  it("rechaza plazo máximo menor al mínimo", () => {
    const resultado = crearProducto({ ...DATOS_OK, plazoMinMeses: 24, plazoMaxMeses: 12 });
    expect(resultado.ok).toBe(false);
  });
});

describe("actualizarReglas", () => {
  const PRODUCTO: ProductoCredito = { id: "prod-1", ...DATOS_OK };

  it("reemplaza las reglas cuando son válidas", () => {
    const nuevas: ReglasDecision = { ...REGLAS_OK, scoreMinimo: 680, scoreRevision: 720 };
    const resultado = actualizarReglas(PRODUCTO, nuevas);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.reglasDecision.scoreMinimo).toBe(680);
      expect(resultado.valor.id).toBe("prod-1"); // el resto del producto no cambia
    }
  });

  it("rechaza reglas inválidas sin tocar el producto", () => {
    const resultado = actualizarReglas(PRODUCTO, { ...REGLAS_OK, ltvMaximo: 2 });
    expect(resultado.ok).toBe(false);
  });
});
