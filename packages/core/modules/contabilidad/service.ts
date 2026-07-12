// Fachada del módulo (patrón Medusa v2) — token modulo.contabilidad.service.

import type { RegistrarAsiento } from "./application/record-entry";
import type { AsientoContable } from "./domain/journal-entry";

export class ContabilidadService {
  constructor(private readonly casoRegistrar: RegistrarAsiento) {}

  registrarAsiento(asiento: AsientoContable) {
    return this.casoRegistrar.ejecutar(asiento);
  }
}
