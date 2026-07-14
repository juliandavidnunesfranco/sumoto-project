import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import type { ProductoCredito } from "../domain/credit-product";
import type { Decision } from "../domain/decision";
import { MotorDecisionV1 } from "../domain/decision-engine";
import type { Solicitud } from "../domain/loan-application";
import type {
  RepositorioProductos,
  RepositorioSolicitudes,
} from "../domain/repositories";
import type { ConsultorRiesgo } from "../domain/risk-advisor";
import type { ReporteRiesgo } from "../domain/risk-report";
import { EvaluarSolicitud } from "./evaluate-application";

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
  },
  activo: true,
};

const REPORTE_SANO: ReporteRiesgo = {
  cedula: "1012345678",
  score: 720,
  moraMaximaDiasUltimos12Meses: 0,
  endeudamientoCentavos: 0,
  consultadoEn: "2026-07-11T10:00:00Z",
};

const COMANDO = {
  clienteId: "cli-1",
  cedula: "1012345678",
  productoId: "prod-1",
  motoId: "moto-1",
  tiendaId: "tienda-1",
  creadoPor: "vendedor-1",
  valorMotoCentavos: 800_000_000,
  cuotaInicialCentavos: 200_000_000,
  plazoMeses: 24,
  ingresosDeclaradosCentavos: 300_000_000,
};

class ProductosFijos implements RepositorioProductos {
  async buscarPorId(id: string) {
    return id === PRODUCTO.id ? PRODUCTO : null;
  }
  async listarActivos() {
    return [PRODUCTO];
  }
}

class SolicitudesEnMemoria implements RepositorioSolicitudes {
  guardadas: Solicitud[] = [];
  decisiones: Decision[] = [];
  fallarEnDecision = false;

  async guardar(solicitud: Solicitud) {
    const guardada = { ...solicitud, id: `sol-${this.guardadas.length + 1}` };
    this.guardadas.push(guardada);
    return guardada;
  }
  async guardarDecision(_solicitudId: string, decision: Decision) {
    if (this.fallarEnDecision) throw new Error("db caída guardando decisión");
    this.decisiones.push(decision);
  }
  async actualizarEstado() {}
  async eliminar(solicitudId: string) {
    this.guardadas = this.guardadas.filter((s) => s.id !== solicitudId);
  }
  async eliminarDecisiones() {
    this.decisiones = [];
  }
  async buscarPorId(solicitudId: string) {
    return this.guardadas.find((s) => s.id === solicitudId) ?? null;
  }
  async buscarDecision() {
    return this.decisiones[this.decisiones.length - 1] ?? null;
  }
}

class RiesgoFijo implements ConsultorRiesgo {
  constructor(private respuesta: Resultado<ReporteRiesgo, string>) {}
  async consultar() {
    return this.respuesta;
  }
}

function armar(riesgo: ConsultorRiesgo) {
  const solicitudes = new SolicitudesEnMemoria();
  const bus = new EventBus();
  const casoDeUso = new EvaluarSolicitud(
    new ProductosFijos(),
    solicitudes,
    riesgo,
    new MotorDecisionV1(),
    bus,
  );
  return { casoDeUso, solicitudes, bus };
}

describe("EvaluarSolicitud", () => {
  it("evalúa, persiste solicitud+decisión y emite originacion.solicitud.evaluada", async () => {
    const { casoDeUso, solicitudes, bus } = armar(new RiesgoFijo(exito(REPORTE_SANO)));
    const oyente = vi.fn();
    bus.on("originacion.solicitud.evaluada", oyente);

    const resultado = await casoDeUso.ejecutar(COMANDO);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.decision.resultado).toBe("APROBADO");
      expect(resultado.valor.solicitud.estado).toBe("evaluada");
    }
    expect(solicitudes.guardadas).toHaveLength(1);
    expect(solicitudes.decisiones).toHaveLength(1);
    expect(oyente).toHaveBeenCalledOnce();
  });

  it("con el buró caído manda a REVISION_MANUAL con la causa visible (no niega en automático)", async () => {
    const { casoDeUso, solicitudes } = armar(
      new RiesgoFijo(fallo("timeout consultando Experian")),
    );

    const resultado = await casoDeUso.ejecutar(COMANDO);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.decision.resultado).toBe("REVISION_MANUAL");
      expect(resultado.valor.decision.razones.join(" ")).toContain("timeout");
    }
    expect(solicitudes.guardadas).toHaveLength(1);
  });

  it("rechaza producto inexistente sin persistir nada", async () => {
    const { casoDeUso, solicitudes } = armar(new RiesgoFijo(exito(REPORTE_SANO)));

    const resultado = await casoDeUso.ejecutar({
      ...COMANDO,
      productoId: "prod-fantasma",
    });

    expect(resultado.ok).toBe(false);
    expect(solicitudes.guardadas).toHaveLength(0);
  });

  it("si falla guardar la decisión, COMPENSA: la solicitud se elimina y no hay evento", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const { casoDeUso, solicitudes, bus } = armar(new RiesgoFijo(exito(REPORTE_SANO)));
    solicitudes.fallarEnDecision = true;
    const oyente = vi.fn();
    bus.on("originacion.solicitud.evaluada", oyente);

    const resultado = await casoDeUso.ejecutar(COMANDO);

    expect(resultado.ok).toBe(false);
    expect(solicitudes.guardadas).toHaveLength(0); // compensado
    expect(oyente).not.toHaveBeenCalled();
    errorSilenciado.mockRestore();
  });

  it("rechaza solicitud incoherente con el producto (plazo fuera de rango)", async () => {
    const { casoDeUso, solicitudes } = armar(new RiesgoFijo(exito(REPORTE_SANO)));

    const resultado = await casoDeUso.ejecutar({ ...COMANDO, plazoMeses: 60 });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error.join(" ")).toContain("plazo");
    }
    expect(solicitudes.guardadas).toHaveLength(0);
  });
});
