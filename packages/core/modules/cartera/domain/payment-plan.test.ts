import { describe, expect, it } from "vitest";
import { cuotaMensualFrancesaCentavos } from "../../../shared/finance";
import { generarPlanDePagos } from "./payment-plan";

describe("generarPlanDePagos", () => {
  const PARAMS = {
    montoCentavos: 600_000_000, // $6.000.000
    tasaEA: 0.245,
    plazoMeses: 24,
    fechaDesembolso: "2026-07-11",
  };

  it("la suma del capital de las cuotas amortiza EXACTO el monto desembolsado", () => {
    const plan = generarPlanDePagos(PARAMS);
    const capitalTotal = plan.reduce((s, c) => s + c.capitalCentavos, 0);
    expect(capitalTotal).toBe(PARAMS.montoCentavos);
  });

  it("cada cuota (salvo la última) vale exactamente la cuota francesa de originación", () => {
    const plan = generarPlanDePagos(PARAMS);
    const cuotaPrometida = cuotaMensualFrancesaCentavos(
      PARAMS.montoCentavos,
      PARAMS.tasaEA,
      PARAMS.plazoMeses,
    );
    for (const cuota of plan.slice(0, -1)) {
      expect(cuota.capitalCentavos + cuota.interesCentavos).toBe(cuotaPrometida);
    }
    // la última solo difiere por el residuo de redondeo (menos de $1 por mes)
    const ultima = plan[plan.length - 1];
    expect(
      Math.abs(ultima.capitalCentavos + ultima.interesCentavos - cuotaPrometida),
    ).toBeLessThan(PARAMS.plazoMeses * 100);
  });

  it("el interés decrece y el capital crece mes a mes (forma francesa)", () => {
    const plan = generarPlanDePagos(PARAMS);
    for (let n = 1; n < plan.length; n++) {
      expect(plan[n].interesCentavos).toBeLessThan(plan[n - 1].interesCentavos);
      expect(plan[n].capitalCentavos).toBeGreaterThan(plan[n - 1].capitalCentavos);
    }
  });

  it("los vencimientos son mensuales desde el desembolso, con ajuste de fin de mes", () => {
    const plan = generarPlanDePagos({
      ...PARAMS,
      plazoMeses: 3,
      fechaDesembolso: "2026-01-31",
    });
    expect(plan.map((c) => c.fechaVencimiento)).toEqual([
      "2026-02-28", // febrero no tiene 31: se ajusta al último día
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("numera las cuotas 1..plazo y nace sin pagos aplicados", () => {
    const plan = generarPlanDePagos(PARAMS);
    expect(plan).toHaveLength(24);
    expect(plan[0].numero).toBe(1);
    expect(plan[23].numero).toBe(24);
    expect(plan.every((c) => c.capitalPagadoCentavos === 0)).toBe(true);
  });

  it("amortiza exacto también con tasa 0 y montos que no dividen parejo", () => {
    const plan = generarPlanDePagos({
      montoCentavos: 1_000_000,
      tasaEA: 0,
      plazoMeses: 12,
      fechaDesembolso: "2026-07-11",
    });
    const capitalTotal = plan.reduce((s, c) => s + c.capitalCentavos, 0);
    expect(capitalTotal).toBe(1_000_000);
    expect(plan.every((c) => c.interesCentavos === 0)).toBe(true);
  });
});
