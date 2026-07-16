// Desembolsar una solicitud APROBADA por su id: valida el estado de negocio
// y delega en el workflow de desembolso (saga con compensación). Es la puerta
// que usa el rol financiero desde el backoffice — la app solo manda el id.

import { fallo, type Resultado } from "../../../kernel/result";
import type { FuenteSolicitudesAprobadas } from "../domain/approved-application-source";
import type {
  ComandoDesembolsarCredito,
  CreditoDesembolsado,
} from "./disburse-credit";

// Tasa de mora única para la demo (igual que el seed). Cuando SUMOTO defina
// su política, pasa a ser atributo del producto de crédito.
export const TASA_MORA_EA_DEMO = 0.38;

export interface ComandoDesembolsarSolicitud {
  solicitudId: string;
  fechaDesembolso: string; // ISO yyyy-mm-dd
}

interface EjecutorDesembolso {
  ejecutar(
    comando: ComandoDesembolsarCredito,
  ): Promise<Resultado<CreditoDesembolsado, string>>;
}

export class DesembolsarSolicitudAprobada {
  constructor(
    private readonly solicitudes: FuenteSolicitudesAprobadas,
    private readonly casoDesembolsar: EjecutorDesembolso,
  ) {}

  async ejecutar(
    comando: ComandoDesembolsarSolicitud,
  ): Promise<Resultado<CreditoDesembolsado, string>> {
    const solicitud = await this.solicitudes.paraDesembolso(comando.solicitudId);
    if (!solicitud) {
      return fallo("la solicitud no existe o no tiene decisión");
    }
    if (solicitud.estado === "desembolsada") {
      return fallo("la solicitud ya fue desembolsada");
    }
    if (!solicitud.aprobada) {
      return fallo("solo se desembolsan solicitudes APROBADAS por el motor");
    }

    return this.casoDesembolsar.ejecutar({
      solicitudId: solicitud.solicitudId,
      clienteId: solicitud.clienteId,
      tiendaId: solicitud.tiendaId,
      montoCentavos: solicitud.montoAFinanciarCentavos,
      tasaEA: solicitud.tasaEA,
      tasaMoraEA: TASA_MORA_EA_DEMO,
      plazoMeses: solicitud.plazoMeses,
      fechaDesembolso: comando.fechaDesembolso,
    });
  }
}
