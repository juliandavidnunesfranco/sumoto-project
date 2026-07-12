// Contratos de persistencia del módulo (DIP).

import type { AsientoContable } from "./journal-entry";

export type EstadoDespacho = "pendiente" | "despachado" | "fallido";

export interface RepositorioAsientos {
  guardar(asiento: AsientoContable): Promise<AsientoContable>;
  marcarDespacho(
    asientoId: string,
    estado: EstadoDespacho,
    idExterno?: string,
  ): Promise<void>;
}
