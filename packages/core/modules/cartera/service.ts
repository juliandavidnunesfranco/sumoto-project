// Fachada del módulo (patrón Medusa v2) — token modulo.cartera.service.

import type {
  ComandoDesembolsarCredito,
  DesembolsarCredito,
} from "./application/disburse-credit";
import type {
  ComandoRegistrarPago,
  RegistrarPago,
} from "./application/register-payment";

export class CarteraService {
  constructor(
    private readonly casoDesembolsar: DesembolsarCredito,
    private readonly casoRegistrarPago: RegistrarPago,
  ) {}

  desembolsarCredito(comando: ComandoDesembolsarCredito) {
    return this.casoDesembolsar.ejecutar(comando);
  }

  registrarPago(comando: ComandoRegistrarPago) {
    return this.casoRegistrarPago.ejecutar(comando);
  }
}
