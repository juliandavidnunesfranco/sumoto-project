// Oído de originación: cuando cartera desembolsa, la solicitud queda cerrada.
// Cartera NO toca el schema de originación — cada módulo cuida sus datos.

import type { EventoDominio } from "../../../kernel/event-bus";
import type { RepositorioSolicitudes } from "../domain/repositories";

interface PayloadDesembolso {
  solicitudId: string;
  creditoId: string;
}

export function alDesembolsarCredito(solicitudes: RepositorioSolicitudes) {
  return async (evento: unknown): Promise<void> => {
    const { payload } = evento as EventoDominio<PayloadDesembolso>;
    await solicitudes.actualizarEstado(payload.solicitudId, "desembolsada");
    console.log(
      `[originacion] solicitud ${payload.solicitudId} marcada desembolsada (crédito ${payload.creditoId})`,
    );
  };
}
