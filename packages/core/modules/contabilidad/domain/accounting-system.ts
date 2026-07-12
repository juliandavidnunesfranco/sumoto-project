// Contrato del sistema contable externo (World Office) — token integracion.contable.

import type { Resultado } from "../../../kernel/result";
import type { AsientoContable } from "./journal-entry";

export interface SistemaContable {
  despachar(asiento: AsientoContable): Promise<Resultado<{ idExterno: string }, string>>;
}
