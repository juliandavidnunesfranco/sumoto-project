// Tests de la maquinaria PURA de búsqueda multi-columna: builders de
// condiciones or() de PostgREST. Aquí vive lógica de dinero (factor
// pesos→centavos) y de fechas (rangos por año/mes/día) — el corazón de la
// decisión "buscar en cualquier columna" (2026-07-16).

import { describe, expect, it } from "vitest";
import {
  buscaFecha,
  buscaNumero,
  buscaTexto,
  condicionesDeBusqueda,
  sanearTermino,
} from "./filtros";

describe("sanearTermino", () => {
  it("elimina metacaracteres del filtro PostgREST", () => {
    expect(sanearTermino(`  luisa,()*\\."' lópez `)).toBe("luisa lópez");
  });

  it("deja pasar letras, números, guiones y #", () => {
    expect(sanearTermino("2026-07 #a1b2")).toBe("2026-07 #a1b2");
  });
});

describe("buscaTexto", () => {
  it("arma ilike con comodines", () => {
    expect(buscaTexto("cliente_nombre")("luisa")).toBe(
      "cliente_nombre.ilike.%luisa%",
    );
  });
});

describe("buscaNumero", () => {
  it("con factor 100 matchea los centavos que REDONDEAN al peso escrito", () => {
    // la UI muestra Math.round(centavos/100): el usuario busca lo que VE.
    // 277873060 centavos se muestra como $2.778.731 → debe matchear.
    expect(buscaNumero("recaudo_centavos", 100)("2778731")).toBe(
      "and(recaudo_centavos.gte.277873050,recaudo_centavos.lt.277873150)",
    );
  });

  it("sin factor compara el número tal cual (conteos)", () => {
    expect(buscaNumero("pagos")("15")).toBe("pagos.eq.15");
  });

  it("redondea al centavo la base del rango (nunca float en dinero)", () => {
    expect(buscaNumero("capital_centavos", 100)("99.995")).toBe(
      "and(capital_centavos.gte.9950,capital_centavos.lt.10050)",
    );
  });

  it("término no numérico no aplica", () => {
    expect(buscaNumero("pagos")("luisa")).toBeNull();
    expect(buscaNumero("pagos")("")).toBeNull();
  });
});

describe("buscaFecha", () => {
  it("año → rango del año completo", () => {
    expect(buscaFecha("mes")("2026")).toBe(
      "and(mes.gte.2026-01-01,mes.lt.2027-01-01)",
    );
  });

  it("año-mes → rango del mes (respeta cambio de año)", () => {
    expect(buscaFecha("creado_en")("2026-12")).toBe(
      "and(creado_en.gte.2026-12-01,creado_en.lt.2027-01-01)",
    );
  });

  it("fecha completa → rango del día (cubre timestamptz)", () => {
    expect(buscaFecha("creado_en")("2026-07-15")).toBe(
      "and(creado_en.gte.2026-07-15,creado_en.lt.2026-07-16)",
    );
  });

  it("término que no es fecha no aplica", () => {
    expect(buscaFecha("mes")("luisa")).toBeNull();
    expect(buscaFecha("mes")("12000000")).toBeNull();
  });
});

describe("condicionesDeBusqueda", () => {
  const estrategias = [
    buscaTexto("cliente_nombre"),
    buscaNumero("valor_moto_centavos", 100),
    buscaFecha("creado_en"),
  ];

  it("un término numérico aplica a texto (ilike) Y a número (rango)", () => {
    expect(condicionesDeBusqueda(estrategias, "12000000")).toEqual([
      "cliente_nombre.ilike.%12000000%",
      "and(valor_moto_centavos.gte.1199999950,valor_moto_centavos.lt.1200000050)",
    ]);
  });

  it("un término de fecha aplica a texto y a fecha, no a número", () => {
    expect(condicionesDeBusqueda(estrategias, "2026-07")).toEqual([
      "cliente_nombre.ilike.%2026-07%",
      "and(creado_en.gte.2026-07-01,creado_en.lt.2026-08-01)",
    ]);
  });

  it("sin estrategias que acepten, lista vacía (resultado vacío)", () => {
    const soloNumeros = [buscaNumero("pagos"), buscaFecha("mes")];
    expect(condicionesDeBusqueda(soloNumeros, "luisa")).toEqual([]);
  });
});
