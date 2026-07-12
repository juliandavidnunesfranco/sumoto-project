import { describe, expect, it } from "vitest";
import {
  CUENTAS,
  crearAsiento,
  credito,
  debito,
} from "./journal-entry";
import { asientoDeDesembolso, asientoDePago } from "./entry-templates";

const ENCABEZADO = {
  fecha: "2026-07-11",
  descripcion: "prueba",
  eventoOrigen: "test",
  referenciaId: "ref-1",
};

describe("crearAsiento", () => {
  it("acepta un asiento cuadrado", () => {
    const resultado = crearAsiento(ENCABEZADO, [
      debito(CUENTAS.bancos, 100_000),
      credito(CUENTAS.cartera, 100_000),
    ]);
    expect(resultado.ok).toBe(true);
  });

  it("RECHAZA el asiento descuadrado — la invariante sagrada", () => {
    const resultado = crearAsiento(ENCABEZADO, [
      debito(CUENTAS.bancos, 100_000),
      credito(CUENTAS.cartera, 99_999),
    ]);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.join(" ")).toContain("descuadrado");
    }
  });

  it("filtra partidas en cero pero exige al menos dos efectivas", () => {
    const conCeros = crearAsiento(ENCABEZADO, [
      debito(CUENTAS.bancos, 100_000),
      credito(CUENTAS.cartera, 100_000),
      credito(CUENTAS.ingresoMora, 0), // pago sin mora: partida vacía
    ]);
    expect(conCeros.ok).toBe(true);
    if (conCeros.ok) {
      expect(conCeros.valor.partidas).toHaveLength(2);
    }

    const soloUna = crearAsiento(ENCABEZADO, [debito(CUENTAS.bancos, 100_000)]);
    expect(soloUna.ok).toBe(false);
  });

  it("rechaza centavos no enteros", () => {
    const resultado = crearAsiento(ENCABEZADO, [
      debito(CUENTAS.bancos, 100.5),
      credito(CUENTAS.cartera, 100.5),
    ]);
    expect(resultado.ok).toBe(false);
  });
});

describe("plantillas de asientos", () => {
  it("desembolso: DB cartera / CR bancos por el monto", () => {
    const asiento = asientoDeDesembolso({
      creditoId: "cred-1",
      montoCentavos: 600_000_000,
      fecha: "2026-07-11",
    });
    expect(asiento.ok).toBe(true);
    if (asiento.ok) {
      expect(asiento.valor.partidas).toEqual([
        expect.objectContaining({
          cuentaCodigo: CUENTAS.cartera.codigo,
          debitoCentavos: 600_000_000,
        }),
        expect.objectContaining({
          cuentaCodigo: CUENTAS.bancos.codigo,
          creditoCentavos: 600_000_000,
        }),
      ]);
    }
  });

  it("pago con mora y sobrante: DB bancos contra capital + interés + mora + anticipo", () => {
    const asiento = asientoDePago({
      pagoId: "pago-1",
      montoCentavos: 26_000_000,
      capitalCentavos: 19_500_000,
      interesCentavos: 5_000_000,
      moraCentavos: 500_000,
      sobranteCentavos: 1_000_000,
      fecha: "2026-07-11",
    });
    expect(asiento.ok).toBe(true);
    if (asiento.ok) {
      const debitos = asiento.valor.partidas.reduce((s, p) => s + p.debitoCentavos, 0);
      const creditos = asiento.valor.partidas.reduce((s, p) => s + p.creditoCentavos, 0);
      expect(debitos).toBe(26_000_000);
      expect(debitos).toBe(creditos);
      expect(asiento.valor.partidas).toHaveLength(5);
    }
  });

  it("pago simple sin mora ni sobrante: solo 3 partidas (las vacías se filtran)", () => {
    const asiento = asientoDePago({
      pagoId: "pago-2",
      montoCentavos: 25_000_000,
      capitalCentavos: 20_000_000,
      interesCentavos: 5_000_000,
      moraCentavos: 0,
      sobranteCentavos: 0,
      fecha: "2026-07-11",
    });
    expect(asiento.ok).toBe(true);
    if (asiento.ok) {
      expect(asiento.valor.partidas).toHaveLength(3);
    }
  });

  it("payload corrupto (no cuadra) produce fallo, no un asiento torcido", () => {
    const asiento = asientoDePago({
      pagoId: "pago-3",
      montoCentavos: 25_000_000,
      capitalCentavos: 10_000_000, // faltan componentes: descuadra
      interesCentavos: 5_000_000,
      moraCentavos: 0,
      sobranteCentavos: 0,
      fecha: "2026-07-11",
    });
    expect(asiento.ok).toBe(false);
  });
});
