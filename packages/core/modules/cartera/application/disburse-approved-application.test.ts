import { describe, expect, it, vi } from "vitest";
import { exito } from "../../../kernel/result";
import type {
  FuenteSolicitudesAprobadas,
  SolicitudParaDesembolso,
} from "../domain/approved-application-source";
import {
  DesembolsarSolicitudAprobada,
  TASA_MORA_EA_DEMO,
} from "./disburse-approved-application";

const APROBADA: SolicitudParaDesembolso = {
  solicitudId: "sol-1",
  clienteId: "cli-1",
  tiendaId: "tienda-1",
  plazoMeses: 24,
  montoAFinanciarCentavos: 600_000_000,
  tasaEA: 0.245,
  aprobada: true,
  estado: "evaluada",
};

function armar(solicitud: SolicitudParaDesembolso | null) {
  const fuente: FuenteSolicitudesAprobadas = {
    paraDesembolso: async () => solicitud,
  };
  const desembolsar = vi.fn().mockResolvedValue(
    exito({ credito: { id: "cred-1" }, cuotas: [] }),
  );
  const caso = new DesembolsarSolicitudAprobada(fuente, {
    ejecutar: desembolsar,
  });
  return { caso, desembolsar };
}

describe("DesembolsarSolicitudAprobada", () => {
  it("desembolsa una solicitud aprobada con los datos de la solicitud y el producto", async () => {
    const { caso, desembolsar } = armar(APROBADA);

    const resultado = await caso.ejecutar({
      solicitudId: "sol-1",
      fechaDesembolso: "2026-07-15",
    });

    expect(resultado.ok).toBe(true);
    expect(desembolsar).toHaveBeenCalledWith({
      solicitudId: "sol-1",
      clienteId: "cli-1",
      tiendaId: "tienda-1",
      montoCentavos: 600_000_000,
      tasaEA: 0.245,
      tasaMoraEA: TASA_MORA_EA_DEMO,
      plazoMeses: 24,
      fechaDesembolso: "2026-07-15",
    });
  });

  it("rechaza cuando la solicitud no existe o no tiene decisión", async () => {
    const { caso, desembolsar } = armar(null);

    const resultado = await caso.ejecutar({
      solicitudId: "sol-x",
      fechaDesembolso: "2026-07-15",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/no existe/);
    expect(desembolsar).not.toHaveBeenCalled();
  });

  it("rechaza una solicitud cuya decisión no fue APROBADO", async () => {
    const { caso, desembolsar } = armar({ ...APROBADA, aprobada: false });

    const resultado = await caso.ejecutar({
      solicitudId: "sol-1",
      fechaDesembolso: "2026-07-15",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/APROBADA/i);
    expect(desembolsar).not.toHaveBeenCalled();
  });

  it("rechaza una solicitud ya desembolsada (no hay doble desembolso)", async () => {
    const { caso, desembolsar } = armar({ ...APROBADA, estado: "desembolsada" });

    const resultado = await caso.ejecutar({
      solicitudId: "sol-1",
      fechaDesembolso: "2026-07-15",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/ya fue desembolsada/);
    expect(desembolsar).not.toHaveBeenCalled();
  });
});
