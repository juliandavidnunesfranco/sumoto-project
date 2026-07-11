import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../../kernel/event-bus";
import type { Credito } from "../domain/credit";
import type { Cuota } from "../domain/installment";
import type { RepositorioCreditos } from "../domain/repositories";
import { DesembolsarCredito } from "./disburse-credit";

const COMANDO = {
  solicitudId: "sol-1",
  clienteId: "cli-1",
  tiendaId: "tienda-1",
  montoCentavos: 600_000_000,
  tasaEA: 0.245,
  tasaMoraEA: 0.38,
  plazoMeses: 24,
  fechaDesembolso: "2026-07-11",
};

class CreditosEnMemoria implements RepositorioCreditos {
  creditos: Credito[] = [];
  cuotas = new Map<string, Cuota[]>();
  vinculos: Array<[string, string]> = [];
  fallarEnCuotas = false;
  fallarEnVinculo = false;

  async guardar(credito: Credito) {
    const guardado = { ...credito, id: `cred-${this.creditos.length + 1}` };
    this.creditos.push(guardado);
    return guardado;
  }
  async eliminar(creditoId: string) {
    this.creditos = this.creditos.filter((c) => c.id !== creditoId);
  }
  async buscarPorId(creditoId: string) {
    return this.creditos.find((c) => c.id === creditoId) ?? null;
  }
  async guardarCuotas(creditoId: string, cuotas: Cuota[]) {
    if (this.fallarEnCuotas) throw new Error("db caída guardando cuotas");
    const conIds = cuotas.map((c, n) => ({ ...c, id: `cuo-${n + 1}`, creditoId }));
    this.cuotas.set(creditoId, conIds);
    return conIds;
  }
  async eliminarCuotasDeCredito(creditoId: string) {
    this.cuotas.delete(creditoId);
  }
  async cuotasDeCredito(creditoId: string) {
    return this.cuotas.get(creditoId) ?? [];
  }
  async vincularSolicitud(solicitudId: string, creditoId: string) {
    if (this.fallarEnVinculo) throw new Error("db caída vinculando");
    this.vinculos.push([solicitudId, creditoId]);
  }
  async desvincularSolicitud(solicitudId: string, creditoId: string) {
    this.vinculos = this.vinculos.filter(
      ([s, c]) => !(s === solicitudId && c === creditoId),
    );
  }
}

describe("DesembolsarCredito (workflow con compensación)", () => {
  it("desembolso completo: crédito + 24 cuotas + vínculo + evento", async () => {
    const repo = new CreditosEnMemoria();
    const bus = new EventBus();
    const oyente = vi.fn();
    bus.on("cartera.credito.desembolsado", oyente);

    const resultado = await new DesembolsarCredito(repo, bus).ejecutar(COMANDO);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.cuotas).toHaveLength(24);
      expect(resultado.valor.credito.cuotaCentavos).toBeGreaterThan(0);
    }
    expect(repo.creditos).toHaveLength(1);
    expect(repo.vinculos).toEqual([["sol-1", "cred-1"]]);
    expect(oyente).toHaveBeenCalledOnce();
  });

  it("si falla guardar cuotas, COMPENSA: el crédito creado se elimina y no hay evento", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const repo = new CreditosEnMemoria();
    repo.fallarEnCuotas = true;
    const bus = new EventBus();
    const oyente = vi.fn();
    bus.on("cartera.credito.desembolsado", oyente);

    const resultado = await new DesembolsarCredito(repo, bus).ejecutar(COMANDO);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("generar-plan-de-cuotas");
    }
    expect(repo.creditos).toHaveLength(0); // compensado
    expect(repo.vinculos).toHaveLength(0);
    expect(oyente).not.toHaveBeenCalled();
    errorSilenciado.mockRestore();
  });

  it("si falla el vínculo, COMPENSA en reversa: sin cuotas, sin crédito, sin evento", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const repo = new CreditosEnMemoria();
    repo.fallarEnVinculo = true;
    const bus = new EventBus();
    const oyente = vi.fn();
    bus.on("cartera.credito.desembolsado", oyente);

    const resultado = await new DesembolsarCredito(repo, bus).ejecutar(COMANDO);

    expect(resultado.ok).toBe(false);
    expect(repo.creditos).toHaveLength(0);
    expect(repo.cuotas.size).toBe(0);
    expect(oyente).not.toHaveBeenCalled();
    errorSilenciado.mockRestore();
  });
});
