import { describe, expect, it, vi } from "vitest";
import { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio } from "./container";
import { EventBus } from "./event-bus";
import { ejecutarWorkflow, type PasoWorkflow } from "./workflow";

describe("container", () => {
  it("registrarServicio deja el servicio resoluble con get (container REAL)", () => {
    // regresión: set() sin definición synthetic previa lanza
    // ServiceNotFoundException en node-dependency-injection
    const container = new ContainerBuilder();
    const instancia = { hola: "mundo" };

    registrarServicio(container, "kernel.eventBus", instancia);

    expect(container.get("kernel.eventBus")).toBe(instancia);
    // re-registrar bajo el mismo token reemplaza sin explotar
    const otra = { hola: "otra" };
    registrarServicio(container, "kernel.eventBus", otra);
    expect(container.get("kernel.eventBus")).toBe(otra);
  });
});

describe("EventBus", () => {
  it("un manejador que falla no tumba al emisor ni a los demás oyentes", async () => {
    const bus = new EventBus();
    const errorSilenciado = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const oyenteSano = vi.fn();

    bus.on("cartera.pago.registrado", () => {
      throw new Error("oyente roto");
    });
    bus.on("cartera.pago.registrado", oyenteSano);

    await expect(
      bus.emit("cartera.pago.registrado", { montoCentavos: 150000 }),
    ).resolves.toBeUndefined();
    expect(oyenteSano).toHaveBeenCalledOnce();

    errorSilenciado.mockRestore();
  });

  it("entrega nombre, payload y correlacionId al manejador", async () => {
    const bus = new EventBus();
    const recibido = vi.fn();
    bus.on("credito.desembolsado", recibido);

    await bus.emit("credito.desembolsado", { creditoId: "c-1" }, "corr-42");

    expect(recibido).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: "credito.desembolsado",
        payload: { creditoId: "c-1" },
        correlacionId: "corr-42",
      }),
    );
  });
});

describe("ejecutarWorkflow", () => {
  type Ctx = { rastro: string[] };

  const paso = (
    nombre: string,
    opts: { falla?: boolean } = {},
  ): PasoWorkflow<Ctx> => ({
    nombre,
    async invocar(ctx) {
      if (opts.falla) throw new Error(`${nombre} falló`);
      ctx.rastro.push(`hacer:${nombre}`);
    },
    async compensar(ctx) {
      ctx.rastro.push(`deshacer:${nombre}`);
    },
  });

  it("ejecuta todos los pasos en orden cuando nada falla", async () => {
    const ctx: Ctx = { rastro: [] };
    const resultado = await ejecutarWorkflow(
      "demo",
      [paso("a"), paso("b")],
      ctx,
    );

    expect(resultado.ok).toBe(true);
    expect(ctx.rastro).toEqual(["hacer:a", "hacer:b"]);
  });

  it("compensa en orden inverso solo lo ejecutado cuando un paso falla", async () => {
    const errorSilenciado = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const ctx: Ctx = { rastro: [] };

    const resultado = await ejecutarWorkflow(
      "desembolso",
      [paso("a"), paso("b"), paso("c", { falla: true }), paso("d")],
      ctx,
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.pasoFallido).toBe("c");
    expect(ctx.rastro).toEqual([
      "hacer:a",
      "hacer:b",
      "deshacer:b",
      "deshacer:a",
    ]);

    errorSilenciado.mockRestore();
  });
});
