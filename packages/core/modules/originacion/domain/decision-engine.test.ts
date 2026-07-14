import { describe, expect, it } from "vitest";
import type { ProductoCredito } from "./credit-product";
import { decidirSolicitud } from "./decision-engine";
import type { Solicitud } from "./loan-application";
import type { ReporteRiesgo } from "./risk-report";

// Producto de referencia: políticas típicas de crédito de moto
const PRODUCTO: ProductoCredito = {
  id: "prod-1",
  nombre: "Moto Fácil 24",
  tasaEA: 0.245,
  plazoMinMeses: 6,
  plazoMaxMeses: 48,
  reglasDecision: {
    scoreMinimo: 600,
    scoreRevision: 650,
    cuotaMaximaPorcentajeIngreso: 0.35,
    ltvMaximo: 0.9,
    ingresoMinimoCentavos: 130_000_000, // $1.300.000 (~SMLMV)
    moraMaximaDias: 60,
  },
  activo: true,
};

// Solicitud sana: moto de $8.000.000, inicial $2.000.000 (LTV 75%),
// 24 meses, ingresos $3.000.000 → cuota ~$316.000 = ~10.5% del ingreso
const SOLICITUD: Solicitud = {
  clienteId: "cli-1",
  productoId: "prod-1",
  motoId: "moto-1",
  tiendaId: "tienda-1",
  creadoPor: "vendedor-1",
  valorMotoCentavos: 800_000_000,
  cuotaInicialCentavos: 200_000_000,
  plazoMeses: 24,
  ingresosDeclaradosCentavos: 300_000_000,
  estado: "pendiente",
};

const REPORTE_SANO: ReporteRiesgo = {
  cedula: "1012345678",
  score: 720,
  moraMaximaDiasUltimos12Meses: 0,
  endeudamientoCentavos: 0,
  consultadoEn: "2026-07-11T10:00:00Z",
};

describe("decidirSolicitud", () => {
  it("APRUEBA la solicitud sana y explica cada chequeo superado", () => {
    const decision = decidirSolicitud(SOLICITUD, PRODUCTO, REPORTE_SANO);

    expect(decision.resultado).toBe("APROBADO");
    expect(decision.cuotaEstimadaCentavos).toBeGreaterThan(0);
    // explicabilidad: una razón por cada política evaluada (5 en este producto)
    expect(decision.razones).toHaveLength(5);
  });

  it("NIEGA por score bajo el mínimo, con razón explícita", () => {
    const decision = decidirSolicitud(SOLICITUD, PRODUCTO, {
      ...REPORTE_SANO,
      score: 550,
    });

    expect(decision.resultado).toBe("NEGADO");
    expect(decision.razones.join(" ")).toContain("score 550 por debajo del mínimo 600");
  });

  it("manda a REVISION_MANUAL el score en zona gris (600–650)", () => {
    const decision = decidirSolicitud(SOLICITUD, PRODUCTO, {
      ...REPORTE_SANO,
      score: 620,
    });

    expect(decision.resultado).toBe("REVISION_MANUAL");
    expect(decision.razones.join(" ")).toContain("zona de revisión");
  });

  it("NIEGA por mora en buró superior a la tolerada", () => {
    const decision = decidirSolicitud(SOLICITUD, PRODUCTO, {
      ...REPORTE_SANO,
      moraMaximaDiasUltimos12Meses: 90,
    });

    expect(decision.resultado).toBe("NEGADO");
    expect(decision.razones.join(" ")).toContain("mora de 90 días");
  });

  it("NIEGA por capacidad de pago: cuota sobre el 35% del ingreso", () => {
    const decision = decidirSolicitud(
      { ...SOLICITUD, ingresosDeclaradosCentavos: 130_000_000 }, // $1.300.000
      PRODUCTO,
      REPORTE_SANO,
    );

    // cuota ~$316.000 sobre ingreso $1.300.000 = ~24%... aún pasa; bajar plazo
    const decisionCorta = decidirSolicitud(
      {
        ...SOLICITUD,
        ingresosDeclaradosCentavos: 130_000_000,
        plazoMeses: 6,
      },
      PRODUCTO,
      REPORTE_SANO,
    );
    expect(decisionCorta.resultado).toBe("NEGADO");
    expect(decisionCorta.razones.join(" ")).toContain("del ingreso");
    // el caso a 24 meses sí cabe en capacidad
    expect(decision.resultado).toBe("APROBADO");
  });

  it("NIEGA por LTV: sin cuota inicial suficiente", () => {
    const decision = decidirSolicitud(
      { ...SOLICITUD, cuotaInicialCentavos: 0 }, // LTV 100%
      PRODUCTO,
      REPORTE_SANO,
    );

    expect(decision.resultado).toBe("NEGADO");
    expect(decision.razones.join(" ")).toContain("LTV");
  });

  it("NIEGA por ingreso bajo el mínimo del producto", () => {
    const decision = decidirSolicitud(
      { ...SOLICITUD, ingresosDeclaradosCentavos: 100_000_000 },
      PRODUCTO,
      REPORTE_SANO,
    );

    expect(decision.resultado).toBe("NEGADO");
    expect(decision.razones.join(" ")).toContain("mínimo del producto");
  });

  it("acumula TODAS las causales: NEGADO gana sobre REVISION_MANUAL", () => {
    const decision = decidirSolicitud(
      { ...SOLICITUD, cuotaInicialCentavos: 0 }, // LTV 100% → negado
      PRODUCTO,
      { ...REPORTE_SANO, score: 620 }, // zona gris → revisión
    );

    expect(decision.resultado).toBe("NEGADO");
    const texto = decision.razones.join(" ");
    expect(texto).toContain("LTV");
    expect(texto).toContain("zona de revisión");
  });

  it("sin reglas opcionales (ingreso mínimo / mora) solo evalúa las obligatorias", () => {
    const productoSimple: ProductoCredito = {
      ...PRODUCTO,
      reglasDecision: {
        scoreMinimo: 600,
        cuotaMaximaPorcentajeIngreso: 0.35,
        ltvMaximo: 0.9,
      },
    };
    const decision = decidirSolicitud(SOLICITUD, productoSimple, REPORTE_SANO);

    expect(decision.resultado).toBe("APROBADO");
    expect(decision.razones).toHaveLength(3); // score, capacidad, LTV
  });
});
