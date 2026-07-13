import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import type { SistemaContable } from "../domain/accounting-system";
import type { AsientoContable } from "../domain/journal-entry";
import type {
  EstadoDespacho,
  RepositorioAsientos,
} from "../domain/repositories";
import { RegistrarAsiento } from "../application/record-entry";
import { ContabilidadService } from "../service";
import { alDesembolsarCredito, alRegistrarPago } from "./on-cartera-events";

class AsientosEnMemoria implements RepositorioAsientos {
  guardados: AsientoContable[] = [];
  despachos: Array<[string, EstadoDespacho, string | undefined]> = [];
  partidasGuardadas = 0;
  fallarEnPartidas = false;

  async guardarEncabezado(asiento: AsientoContable) {
    const guardado = { ...asiento, id: `as-${this.guardados.length + 1}` };
    this.guardados.push(guardado);
    return guardado;
  }
  async guardarPartidas(asiento: AsientoContable) {
    if (this.fallarEnPartidas) throw new Error("db caída guardando partidas");
    this.partidasGuardadas += asiento.partidas.length;
  }
  async eliminar(asientoId: string) {
    this.guardados = this.guardados.filter((a) => a.id !== asientoId);
  }
  async marcarDespacho(id: string, estado: EstadoDespacho, idExterno?: string) {
    this.despachos.push([id, estado, idExterno]);
  }
}

class WorldOfficeFijo implements SistemaContable {
  constructor(private respuesta: Resultado<{ idExterno: string }, string>) {}
  async despachar() {
    return this.respuesta;
  }
}

function armar(wo: SistemaContable) {
  const asientos = new AsientosEnMemoria();
  const registrar = new ContabilidadService(new RegistrarAsiento(asientos, wo));
  const bus = new EventBus();
  bus.on("cartera.credito.desembolsado", alDesembolsarCredito(registrar));
  bus.on("cartera.pago.registrado", alRegistrarPago(registrar));
  return { asientos, bus };
}

describe("contabilidad escucha a cartera (flujo completo por el bus)", () => {
  it("desembolso → asiento cuadrado persistido y despachado a World Office", async () => {
    const { asientos, bus } = armar(new WorldOfficeFijo(exito({ idExterno: "WO-1" })));

    await bus.emit("cartera.credito.desembolsado", {
      creditoId: "cred-1",
      solicitudId: "sol-1",
      montoCentavos: 600_000_000,
      fecha: "2026-07-01", // desembolso retroactivo: el asiento lleva ESTA fecha
    });

    expect(asientos.guardados).toHaveLength(1);
    expect(asientos.guardados[0].eventoOrigen).toBe("cartera.credito.desembolsado");
    expect(asientos.guardados[0].fecha).toBe("2026-07-01");
    expect(asientos.despachos).toEqual([["as-1", "despachado", "WO-1"]]);
  });

  it("pago → asiento con los totales por componente que emitió cartera", async () => {
    const { asientos, bus } = armar(new WorldOfficeFijo(exito({ idExterno: "WO-2" })));

    await bus.emit("cartera.pago.registrado", {
      pagoId: "pago-1",
      creditoId: "cred-1",
      montoCentavos: 26_000_000,
      sobranteCentavos: 0,
      mora: 1_000_000,
      interes: 5_000_000,
      capital: 20_000_000,
    });

    expect(asientos.guardados).toHaveLength(1);
    const partidas = asientos.guardados[0].partidas;
    const debitos = partidas.reduce((s, p) => s + p.debitoCentavos, 0);
    const creditos = partidas.reduce((s, p) => s + p.creditoCentavos, 0);
    expect(debitos).toBe(26_000_000);
    expect(debitos).toBe(creditos);
  });

  it("World Office caído: el asiento SE PERSISTE y queda 'fallido' para reintento", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const { asientos, bus } = armar(new WorldOfficeFijo(fallo("WO sin conexión")));

    await bus.emit("cartera.credito.desembolsado", {
      creditoId: "cred-1",
      montoCentavos: 600_000_000,
    });

    expect(asientos.guardados).toHaveLength(1); // la contabilidad interna no se pierde
    expect(asientos.despachos).toEqual([["as-1", "fallido", undefined]]);
    errorSilenciado.mockRestore();
  });

  it("si fallan las partidas, COMPENSA: el encabezado se elimina (sin asientos huérfanos)", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const asientos = new AsientosEnMemoria();
    asientos.fallarEnPartidas = true;
    const registrar = new ContabilidadService(
      new RegistrarAsiento(asientos, new WorldOfficeFijo(exito({ idExterno: "WO-9" }))),
    );
    const bus = new EventBus();
    bus.on("cartera.credito.desembolsado", alDesembolsarCredito(registrar));

    // el bus aísla la excepción del subscriber; el encabezado debe quedar compensado
    await bus.emit("cartera.credito.desembolsado", {
      creditoId: "cred-1",
      montoCentavos: 600_000_000,
    });

    expect(asientos.guardados).toHaveLength(0); // compensado
    expect(asientos.despachos).toHaveLength(0); // jamás llegó a World Office
    errorSilenciado.mockRestore();
  });

  it("payload descuadrado: no persiste asiento torcido y no tumba el bus", async () => {
    const errorSilenciado = vi.spyOn(console, "error").mockImplementation(() => {});
    const { asientos, bus } = armar(new WorldOfficeFijo(exito({ idExterno: "WO-3" })));

    await expect(
      bus.emit("cartera.pago.registrado", {
        pagoId: "pago-x",
        montoCentavos: 100,
        sobranteCentavos: 0,
        mora: 0,
        interes: 0,
        capital: 50, // no cuadra con el monto
      }),
    ).resolves.toBeUndefined();

    expect(asientos.guardados).toHaveLength(0);
    errorSilenciado.mockRestore();
  });
});
