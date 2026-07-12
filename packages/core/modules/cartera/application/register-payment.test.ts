import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../../kernel/event-bus";
import type { Credito } from "../domain/credit";
import type { Cuota } from "../domain/installment";
import type { Pago } from "../domain/payment";
import type { AplicacionPago } from "../domain/payment-allocation";
import type {
  AcumuladosCuota,
  RepositorioCreditos,
  RepositorioPagos,
} from "../domain/repositories";
import { RegistrarPago } from "./register-payment";

const CREDITO: Credito = {
  id: "cred-1",
  clienteId: "cli-1",
  tiendaId: "tienda-1",
  montoDesembolsadoCentavos: 40_000_000,
  tasaEA: 0.245,
  tasaMoraEA: 0.38,
  plazoMeses: 2,
  cuotaCentavos: 25_000_000,
  estado: "activo",
  desembolsadoEn: "2025-12-15",
};

function cuotasDelPlan(): Cuota[] {
  return [1, 2].map((numero) => ({
    id: `cuo-${numero}`,
    creditoId: "cred-1",
    numero,
    fechaVencimiento: `2026-0${numero}-15`,
    capitalCentavos: 20_000_000,
    interesCentavos: 5_000_000,
    capitalPagadoCentavos: 0,
    interesPagadoCentavos: 0,
    moraPagadaCentavos: 0,
  }));
}

class CreditosFijos implements RepositorioCreditos {
  constructor(
    private credito: Credito | null,
    private cuotas: Cuota[],
  ) {}
  async buscarPorId() {
    return this.credito;
  }
  async cuotasDeCredito() {
    return this.cuotas;
  }
  async guardar(c: Credito) { return c; }
  async eliminar() {}
  async guardarCuotas(_: string, c: Cuota[]) { return c; }
  async eliminarCuotasDeCredito() {}
  async vincularSolicitud() {}
  async desvincularSolicitud() {}
}

class PagosEnMemoria implements RepositorioPagos {
  pagos: Pago[] = [];
  aplicaciones: AplicacionPago[] = [];
  acumulados = new Map<string, AcumuladosCuota>();
  fallarAcumuladosEnLlamada = 0; // 0 = nunca; N = falla en la N-ésima llamada
  private llamadasAcumulados = 0;

  async guardar(pago: Pago, aplicaciones: AplicacionPago[]) {
    const guardado = { ...pago, id: `pago-${this.pagos.length + 1}` };
    this.pagos.push(guardado);
    this.aplicaciones.push(...aplicaciones);
    return guardado;
  }
  async actualizarAcumulados(cuotaId: string, acumulados: AcumuladosCuota) {
    this.llamadasAcumulados += 1;
    if (this.llamadasAcumulados === this.fallarAcumuladosEnLlamada) {
      throw new Error("db caída actualizando cuota");
    }
    this.acumulados.set(cuotaId, acumulados);
  }
  async eliminar(pagoId: string) {
    this.pagos = this.pagos.filter((p) => p.id !== pagoId);
  }
}

function armar(credito: Credito | null, cuotas: Cuota[]) {
  const pagos = new PagosEnMemoria();
  const bus = new EventBus();
  const casoDeUso = new RegistrarPago(new CreditosFijos(credito, cuotas), pagos, bus);
  return { casoDeUso, pagos, bus };
}

describe("RegistrarPago", () => {
  it("pago al día: persiste pago+aplicaciones, actualiza acumulados y emite evento", async () => {
    const { casoDeUso, pagos, bus } = armar(CREDITO, cuotasDelPlan());
    const oyente = vi.fn();
    bus.on("cartera.pago.registrado", oyente);

    const resultado = await casoDeUso.ejecutar({
      creditoId: "cred-1",
      montoCentavos: 25_000_000,
      fechaPago: "2026-01-15",
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.totalesPorComponente).toEqual({
        mora: 0,
        interes: 5_000_000,
        capital: 20_000_000,
      });
    }
    expect(pagos.pagos).toHaveLength(1);
    expect(pagos.acumulados.get("cuo-1")).toEqual({
      capitalPagadoCentavos: 20_000_000,
      interesPagadoCentavos: 5_000_000,
      moraPagadaCentavos: 0,
    });
    expect(oyente).toHaveBeenCalledOnce();
  });

  it("pago en mora: el evento reporta cuánto fue a mora (insumo contable)", async () => {
    const { casoDeUso } = armar(CREDITO, cuotasDelPlan());

    const resultado = await casoDeUso.ejecutar({
      creditoId: "cred-1",
      montoCentavos: 26_000_000,
      fechaPago: "2026-02-14", // cuota 1 con 30 días de mora
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.totalesPorComponente.mora).toBeGreaterThan(0);
      const total = Object.values(resultado.valor.totalesPorComponente).reduce(
        (a, b) => a + b,
        0,
      );
      expect(total + resultado.valor.pago.sobranteCentavos).toBe(26_000_000);
    }
  });

  it("si falla actualizar cuotas, COMPENSA: el pago se elimina, acumulados restaurados, sin evento", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const { casoDeUso, pagos, bus } = armar(CREDITO, cuotasDelPlan());
    // pago que toca 2 cuotas: la primera se actualiza bien, la segunda falla
    pagos.fallarAcumuladosEnLlamada = 2;
    const oyente = vi.fn();
    bus.on("cartera.pago.registrado", oyente);

    const resultado = await casoDeUso.ejecutar({
      creditoId: "cred-1",
      montoCentavos: 50_000_000, // cubre ambas cuotas
      fechaPago: "2026-02-15",
    });

    expect(resultado.ok).toBe(false);
    expect(pagos.pagos).toHaveLength(0); // pago compensado
    // la cuota 1 (única tocada con éxito) volvió a sus acumulados originales
    expect(pagos.acumulados.get("cuo-1")).toMatchObject({
      capitalPagadoCentavos: 0,
      interesPagadoCentavos: 0,
      moraPagadaCentavos: 0,
    });
    expect(oyente).not.toHaveBeenCalled();
    errorSilenciado.mockRestore();
  });

  it("rechaza crédito inexistente, cancelado, sin saldo, y montos inválidos", async () => {
    const inexistente = armar(null, []);
    expect(
      (await inexistente.casoDeUso.ejecutar({ creditoId: "x", montoCentavos: 100, fechaPago: "2026-01-15" })).ok,
    ).toBe(false);

    const cancelado = armar({ ...CREDITO, estado: "cancelado" }, cuotasDelPlan());
    expect(
      (await cancelado.casoDeUso.ejecutar({ creditoId: "cred-1", montoCentavos: 100, fechaPago: "2026-01-15" })).ok,
    ).toBe(false);

    const saldado = armar(
      CREDITO,
      cuotasDelPlan().map((c) => ({
        ...c,
        capitalPagadoCentavos: c.capitalCentavos,
        interesPagadoCentavos: c.interesCentavos,
      })),
    );
    expect(
      (await saldado.casoDeUso.ejecutar({ creditoId: "cred-1", montoCentavos: 100, fechaPago: "2026-01-15" })).ok,
    ).toBe(false);

    const { casoDeUso } = armar(CREDITO, cuotasDelPlan());
    expect(
      (await casoDeUso.ejecutar({ creditoId: "cred-1", montoCentavos: 100.5, fechaPago: "2026-01-15" })).ok,
    ).toBe(false);
  });
});
