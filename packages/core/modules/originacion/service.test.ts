import { describe, expect, it } from "vitest";
import type { Decision } from "./domain/decision";
import type { ProductoCredito } from "./domain/credit-product";
import type { Solicitud } from "./domain/loan-application";
import type {
  RepositorioProductos,
  RepositorioSolicitudes,
} from "./domain/repositories";
import { OriginacionService } from "./service";

const PRODUCTO: ProductoCredito = {
  id: "prod-1",
  nombre: "Crédito Moto",
  tasaEA: 0.245,
  plazoMinMeses: 6,
  plazoMaxMeses: 48,
  reglasDecision: { cuotaMaximaPorcentajeIngreso: 0.35 },
  activo: true,
};

const SOLICITUD: Solicitud = {
  id: "sol-1",
  clienteId: "cli-1",
  productoId: "prod-1",
  motoId: "moto-1",
  tiendaId: "tienda-1",
  creadoPor: "user-1",
  valorMotoCentavos: 800_000_000,
  cuotaInicialCentavos: 200_000_000,
  cargosAdicionalesCentavos: 10_000_000,
  plazoMeses: 24,
  ingresosDeclaradosCentavos: 300_000_000,
  estado: "evaluada",
};

const DECISION: Decision = {
  resultado: "APROBADO",
  razones: ["cumple políticas"],
  cuotaEstimadaCentavos: 30_000_000,
};

function armarServicio(opciones: {
  solicitud?: Solicitud | null;
  decision?: Decision | null;
  producto?: ProductoCredito | null;
}) {
  const solicitudes = {
    buscarPorId: async () => opciones.solicitud ?? null,
    buscarDecision: async () => opciones.decision ?? null,
  } as unknown as RepositorioSolicitudes;
  const productos = {
    buscarPorId: async () => opciones.producto ?? null,
  } as unknown as RepositorioProductos;

  return new OriginacionService(
    null as never, // casoEvaluar: no participa en paraDesembolso
    productos,
    solicitudes,
    null as never, // consultorRiesgo
    null as never, // motor
  );
}

describe("OriginacionService.paraDesembolso", () => {
  it("arma el DTO con monto a financiar (moto - inicial + cargos) y tasa del producto", async () => {
    const svc = armarServicio({
      solicitud: SOLICITUD,
      decision: DECISION,
      producto: PRODUCTO,
    });

    const dto = await svc.paraDesembolso("sol-1");

    expect(dto).toEqual({
      solicitudId: "sol-1",
      clienteId: "cli-1",
      tiendaId: "tienda-1",
      plazoMeses: 24,
      montoAFinanciarCentavos: 610_000_000,
      tasaEA: 0.245,
      aprobada: true,
      estado: "evaluada",
    });
  });

  it("devuelve null si la solicitud no tiene decisión todavía", async () => {
    const svc = armarServicio({
      solicitud: SOLICITUD,
      decision: null,
      producto: PRODUCTO,
    });

    expect(await svc.paraDesembolso("sol-1")).toBeNull();
  });

  it("marca aprobada=false cuando la decisión fue NEGADO", async () => {
    const svc = armarServicio({
      solicitud: SOLICITUD,
      decision: { ...DECISION, resultado: "NEGADO" },
      producto: PRODUCTO,
    });

    const dto = await svc.paraDesembolso("sol-1");
    expect(dto?.aprobada).toBe(false);
  });
});
