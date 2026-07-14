import { describe, expect, it } from "vitest";
import type { DatosCiudadano } from "./citizen-data";
import {
  crearCliente,
  esCedulaValida,
  esMayorDeEdad,
  validarParaRegistro,
  type DatosRegistro,
} from "./client";

const DATOS_OK: DatosCiudadano = {
  cedula: "1012345678",
  nombres: "Carlos",
  apellidos: "Rodríguez",
  fechaNacimiento: "1990-05-15",
};

const REGISTRO_OK: DatosRegistro = {
  ingresosDeclaradosCentavos: 250_000_000, // $2.500.000 COP
  fuenteIdentidad: "entrada_manual",
  tiendaId: "tienda-1",
};

describe("esCedulaValida", () => {
  it.each(["123456", "1012345678", " 987654321 "])("acepta %s", (cedula) => {
    expect(esCedulaValida(cedula)).toBe(true);
  });

  it.each(["12345", "12345678901", "10.123.456", "abc123", ""])(
    "rechaza %s",
    (cedula) => {
      expect(esCedulaValida(cedula)).toBe(false);
    },
  );
});

describe("esMayorDeEdad", () => {
  const hoy = new Date("2026-07-11T12:00:00");

  it("acepta a quien cumplió 18 exactamente hoy", () => {
    expect(esMayorDeEdad("2008-07-11", hoy)).toBe(true);
  });

  it("rechaza a quien cumple 18 mañana", () => {
    expect(esMayorDeEdad("2008-07-12", hoy)).toBe(false);
  });

  it("rechaza fechas ilegibles", () => {
    expect(esMayorDeEdad("no-es-fecha", hoy)).toBe(false);
  });
});

describe("validarParaRegistro", () => {
  it("acepta datos completos y válidos", () => {
    expect(validarParaRegistro(DATOS_OK, REGISTRO_OK)).toEqual([]);
  });

  it("acepta sin fecha de nacimiento ni ingresos (opcionales)", () => {
    const { fechaNacimiento: _fn, ...sinFecha } = DATOS_OK;
    const { ingresosDeclaradosCentavos: _ing, ...sinIngresos } = REGISTRO_OK;
    expect(validarParaRegistro(sinFecha, sinIngresos)).toEqual([]);
  });

  it("acumula TODAS las violaciones, no solo la primera", () => {
    const violaciones = validarParaRegistro(
      { cedula: "abc", nombres: " ", apellidos: "" },
      { ...REGISTRO_OK, ingresosDeclaradosCentavos: -1, tiendaId: "" },
    );
    expect(violaciones).toHaveLength(5);
  });

  it("rechaza ingresos con decimales (float disfrazado)", () => {
    const violaciones = validarParaRegistro(DATOS_OK, {
      ...REGISTRO_OK,
      ingresosDeclaradosCentavos: 2500000.5,
    });
    expect(violaciones).toHaveLength(1);
    expect(violaciones[0]).toContain("entero en centavos");
  });

  it.each([1, 4, 6])("acepta estrato %i (dentro de 1-6)", (estrato) => {
    expect(validarParaRegistro({ ...DATOS_OK, estrato }, REGISTRO_OK)).toEqual([]);
  });

  it.each([0, 7, 2.5])("rechaza estrato %s (fuera de 1-6 o no entero)", (estrato) => {
    const violaciones = validarParaRegistro({ ...DATOS_OK, estrato }, REGISTRO_OK);
    expect(violaciones).toHaveLength(1);
    expect(violaciones[0]).toContain("estrato");
  });
});

describe("crearCliente", () => {
  it("devuelve la entidad normalizada cuando todo es válido", () => {
    const resultado = crearCliente(
      { ...DATOS_OK, cedula: " 1012345678 ", nombres: " Carlos " },
      REGISTRO_OK,
    );
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.cedula).toBe("1012345678");
      expect(resultado.valor.nombres).toBe("Carlos");
    }
  });

  it("devuelve fallo con las violaciones cuando no", () => {
    const resultado = crearCliente({ ...DATOS_OK, cedula: "x" }, REGISTRO_OK);
    expect(resultado.ok).toBe(false);
  });
});
