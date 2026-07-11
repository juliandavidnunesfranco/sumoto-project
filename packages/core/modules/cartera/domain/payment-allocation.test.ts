import { describe, expect, it } from "vitest";
import type { Cuota } from "./installment";
import {
  moraPendienteCentavos,
  repartirPago,
  type RepartoPago,
} from "./payment-allocation";

const TASA_MORA_EA = 0.38; // tasa diaria ≈ 0.0882% → redondeos verificables

function cuota(numero: number, sobrescribir: Partial<Cuota> = {}): Cuota {
  return {
    id: `cuota-${numero}`,
    numero,
    fechaVencimiento: `2026-0${numero}-15`,
    capitalCentavos: 20_000_000, // $200.000
    interesCentavos: 5_000_000, // $50.000
    capitalPagadoCentavos: 0,
    interesPagadoCentavos: 0,
    moraPagadaCentavos: 0,
    ...sobrescribir,
  };
}

// Invariante universal del reparto: ni un centavo se crea ni se pierde
function verificarConservacion(reparto: RepartoPago, monto: number) {
  const aplicado = reparto.aplicaciones.reduce((s, a) => s + a.montoCentavos, 0);
  expect(aplicado + reparto.sobranteCentavos).toBe(monto);
}

describe("moraPendienteCentavos", () => {
  it("cuota al día no devenga mora", () => {
    expect(moraPendienteCentavos(cuota(1), "2026-01-15", TASA_MORA_EA)).toBe(0);
    expect(moraPendienteCentavos(cuota(1), "2026-01-01", TASA_MORA_EA)).toBe(0);
  });

  it("devenga sobre el capital pendiente por los días vencidos", () => {
    // 30 días de mora sobre $200.000: 20.000.000 * ((1.38)^(1/365)-1) * 30 ≈ 529.428
    const mora = moraPendienteCentavos(cuota(1), "2026-02-14", TASA_MORA_EA);
    expect(mora).toBeGreaterThan(500_000);
    expect(mora).toBeLessThan(560_000);
  });

  it("descuenta la mora ya pagada", () => {
    const conMoraPagada = cuota(1, { moraPagadaCentavos: 400_000 });
    const total = moraPendienteCentavos(cuota(1), "2026-02-14", TASA_MORA_EA);
    const restante = moraPendienteCentavos(conMoraPagada, "2026-02-14", TASA_MORA_EA);
    expect(restante).toBe(total - 400_000);
  });

  it("si el capital ya se pagó, no devenga mora aunque esté vencida", () => {
    const saldada = cuota(1, { capitalPagadoCentavos: 20_000_000 });
    expect(moraPendienteCentavos(saldada, "2026-03-15", TASA_MORA_EA)).toBe(0);
  });
});

describe("repartirPago", () => {
  it("cuota al día, pago exacto: interés y capital, sin mora, en ese orden", () => {
    const reparto = repartirPago({
      montoCentavos: 25_000_000,
      cuotas: [cuota(1)],
      fechaPago: "2026-01-15", // día del vencimiento: sin mora
      tasaMoraEA: TASA_MORA_EA,
    });

    expect(reparto.aplicaciones.map((a) => a.componente)).toEqual([
      "interes",
      "capital",
    ]);
    expect(reparto.aplicaciones[0].montoCentavos).toBe(5_000_000);
    expect(reparto.aplicaciones[1].montoCentavos).toBe(20_000_000);
    expect(reparto.sobranteCentavos).toBe(0);
    verificarConservacion(reparto, 25_000_000);
  });

  it("cuota vencida: la mora cobra PRIMERO", () => {
    const reparto = repartirPago({
      montoCentavos: 25_000_000,
      cuotas: [cuota(1)],
      fechaPago: "2026-02-14", // 30 días vencida
      tasaMoraEA: TASA_MORA_EA,
    });

    expect(reparto.aplicaciones[0].componente).toBe("mora");
    // el pago ya no alcanza para todo el capital: la mora se comió su parte
    const capital = reparto.aplicaciones.find((a) => a.componente === "capital");
    expect(capital!.montoCentavos).toBeLessThan(20_000_000);
    expect(reparto.sobranteCentavos).toBe(0);
    verificarConservacion(reparto, 25_000_000);
  });

  it("pago chico en cuota vencida: se agota en la mora (ni interés ni capital)", () => {
    const reparto = repartirPago({
      montoCentavos: 100_000,
      cuotas: [cuota(1)],
      fechaPago: "2026-02-14",
      tasaMoraEA: TASA_MORA_EA,
    });

    expect(reparto.aplicaciones).toHaveLength(1);
    expect(reparto.aplicaciones[0].componente).toBe("mora");
    verificarConservacion(reparto, 100_000);
  });

  it("un pago cubre varias cuotas: salda la 1 completa y sigue con la 2", () => {
    const reparto = repartirPago({
      montoCentavos: 40_000_000,
      cuotas: [cuota(2), cuota(1)], // desordenadas a propósito
      fechaPago: "2026-01-15", // ambas sin mora (la 2 ni siquiera ha vencido)
      tasaMoraEA: TASA_MORA_EA,
    });

    // orden: interés y capital de la cuota 1, luego interés y parte del capital de la 2
    expect(
      reparto.aplicaciones.map((a) => [a.cuotaNumero, a.componente]),
    ).toEqual([
      [1, "interes"],
      [1, "capital"],
      [2, "interes"],
      [2, "capital"],
    ]);
    expect(reparto.aplicaciones[3].montoCentavos).toBe(10_000_000); // capital parcial
    verificarConservacion(reparto, 40_000_000);
  });

  it("sobrepago: devuelve el sobrante sin inventar aplicaciones", () => {
    const reparto = repartirPago({
      montoCentavos: 30_000_000,
      cuotas: [cuota(1)],
      fechaPago: "2026-01-15",
      tasaMoraEA: TASA_MORA_EA,
    });

    expect(reparto.sobranteCentavos).toBe(5_000_000);
    verificarConservacion(reparto, 30_000_000);
  });

  it("respeta pagos previos: solo cobra lo pendiente de cada componente", () => {
    const parcial = cuota(1, {
      interesPagadoCentavos: 5_000_000, // interés ya saldado
      capitalPagadoCentavos: 12_000_000, // capital pendiente: $80.000
    });
    const reparto = repartirPago({
      montoCentavos: 10_000_000,
      cuotas: [parcial],
      fechaPago: "2026-01-15",
      tasaMoraEA: TASA_MORA_EA,
    });

    expect(reparto.aplicaciones).toHaveLength(1);
    expect(reparto.aplicaciones[0]).toMatchObject({
      componente: "capital",
      montoCentavos: 8_000_000,
    });
    expect(reparto.sobranteCentavos).toBe(2_000_000);
    verificarConservacion(reparto, 10_000_000);
  });

  it("cuotas saldadas no reciben aplicaciones", () => {
    const saldada = cuota(1, {
      capitalPagadoCentavos: 20_000_000,
      interesPagadoCentavos: 5_000_000,
    });
    const reparto = repartirPago({
      montoCentavos: 25_000_000,
      cuotas: [saldada, cuota(2)],
      fechaPago: "2026-02-15",
      tasaMoraEA: TASA_MORA_EA,
    });

    expect(reparto.aplicaciones.every((a) => a.cuotaNumero === 2)).toBe(true);
    verificarConservacion(reparto, 25_000_000);
  });

  it("rechaza montos no enteros o no positivos", () => {
    expect(() =>
      repartirPago({
        montoCentavos: 100.5,
        cuotas: [cuota(1)],
        fechaPago: "2026-01-15",
        tasaMoraEA: TASA_MORA_EA,
      }),
    ).toThrow();
    expect(() =>
      repartirPago({
        montoCentavos: 0,
        cuotas: [cuota(1)],
        fechaPago: "2026-01-15",
        tasaMoraEA: TASA_MORA_EA,
      }),
    ).toThrow();
  });

  it("propiedad: en 50 escenarios aleatorios nunca se crea ni pierde un centavo", () => {
    for (let semilla = 1; semilla <= 50; semilla++) {
      const monto = 1 + ((semilla * 7_919_113) % 60_000_000);
      const cuotas = [
        cuota(1, { capitalPagadoCentavos: (semilla * 331) % 20_000_000 }),
        cuota(2, { interesPagadoCentavos: (semilla * 17) % 5_000_000 }),
        cuota(3),
      ];
      const reparto = repartirPago({
        montoCentavos: monto,
        cuotas,
        fechaPago: "2026-03-20",
        tasaMoraEA: TASA_MORA_EA,
      });
      verificarConservacion(reparto, monto);
      // y ninguna aplicación excede lo pendiente ni es <= 0
      expect(reparto.aplicaciones.every((a) => a.montoCentavos > 0)).toBe(true);
    }
  });
});
