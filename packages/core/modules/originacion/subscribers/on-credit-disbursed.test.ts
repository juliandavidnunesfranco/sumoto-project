import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../../kernel/event-bus";
import type { RepositorioSolicitudes } from "../domain/repositories";
import { alDesembolsarCredito } from "./on-credit-disbursed";

describe("alDesembolsarCredito", () => {
  it("marca la solicitud como desembolsada cuando cartera anuncia el desembolso", async () => {
    const actualizarEstado = vi.fn();
    const solicitudes = { actualizarEstado } as unknown as RepositorioSolicitudes;
    const logSilenciado = vi.spyOn(console, "log").mockImplementation(() => {});

    const bus = new EventBus();
    bus.on("cartera.credito.desembolsado", alDesembolsarCredito(solicitudes));

    await bus.emit("cartera.credito.desembolsado", {
      solicitudId: "sol-1",
      creditoId: "cred-1",
    });

    expect(actualizarEstado).toHaveBeenCalledWith("sol-1", "desembolsada");
    logSilenciado.mockRestore();
  });
});
