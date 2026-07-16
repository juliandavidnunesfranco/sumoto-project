// Fachada del módulo (patrón Medusa v2) — token modulo.cartera.service.

import type {
  ComandoDesembolsarCredito,
  DesembolsarCredito,
} from "./application/disburse-credit";
import type {
  ComandoDesembolsarSolicitud,
  DesembolsarSolicitudAprobada,
} from "./application/disburse-approved-application";
import type {
  ComandoRegistrarPago,
  RegistrarPago,
} from "./application/register-payment";

export class CarteraService {
  constructor(
    private readonly casoDesembolsar: DesembolsarCredito,
    private readonly casoRegistrarPago: RegistrarPago,
    private readonly casoDesembolsarSolicitud: DesembolsarSolicitudAprobada,
  ) {}

  desembolsarCredito(comando: ComandoDesembolsarCredito) {
    return this.casoDesembolsar.ejecutar(comando);
  }

  // La puerta del rol financiero: desembolsa una solicitud APROBADA por id.
  desembolsarSolicitudAprobada(comando: ComandoDesembolsarSolicitud) {
    return this.casoDesembolsarSolicitud.ejecutar(comando);
  }

  registrarPago(comando: ComandoRegistrarPago) {
    return this.casoRegistrarPago.ejecutar(comando);
  }
}
