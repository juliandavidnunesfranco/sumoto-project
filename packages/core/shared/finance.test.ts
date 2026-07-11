import { describe, expect, it } from "vitest";
import { cuotaMensualFrancesaCentavos, tasaMensualDesdeEA } from "./finance";

describe("tasaMensualDesdeEA", () => {
  it("26.8242% EA equivale a 2% mensual", () => {
    // (1.02)^12 - 1 = 0.26824179...
    expect(tasaMensualDesdeEA(0.2682417945625455)).toBeCloseTo(0.02, 10);
  });

  it("tasa 0 EA es 0 mensual", () => {
    expect(tasaMensualDesdeEA(0)).toBe(0);
  });
});

describe("cuotaMensualFrancesaCentavos", () => {
  it("calcula la anualidad clásica: $10.000 al 2% mensual a 12 meses = $945,60", () => {
    // cuota = 1.000.000 * 0.02 / (1 - 1.02^-12) = 94.559,96 centavos → 94.560
    const cuota = cuotaMensualFrancesaCentavos(
      1_000_000,
      0.2682417945625455,
      12,
    );
    expect(cuota).toBe(94_560);
  });

  it("con tasa 0 divide el capital en partes iguales (redondeo hacia arriba)", () => {
    expect(cuotaMensualFrancesaCentavos(1_000_000, 0, 12)).toBe(83_334);
  });

  it("la cuota amortiza el crédito completo (saldo final ~0 con la cuota exacta)", () => {
    const monto = 600_000_000; // $6.000.000 COP
    const tasaEA = 0.245;
    const plazo = 24;
    const cuota = cuotaMensualFrancesaCentavos(monto, tasaEA, plazo);
    const i = tasaMensualDesdeEA(tasaEA);

    let saldo = monto;
    for (let mes = 0; mes < plazo; mes++) {
      saldo = saldo * (1 + i) - cuota;
    }
    // el residuo por redondeo de la cuota debe ser menor a una cuota
    expect(Math.abs(saldo)).toBeLessThan(cuota);
    expect(Math.abs(saldo)).toBeLessThan(monto * 0.001);
  });

  it("rechaza dinero no entero (float disfrazado)", () => {
    expect(() => cuotaMensualFrancesaCentavos(1000.5, 0.24, 12)).toThrow();
  });

  it("rechaza monto y plazo inválidos", () => {
    expect(() => cuotaMensualFrancesaCentavos(0, 0.24, 12)).toThrow();
    expect(() => cuotaMensualFrancesaCentavos(1000, 0.24, 0)).toThrow();
  });
});
