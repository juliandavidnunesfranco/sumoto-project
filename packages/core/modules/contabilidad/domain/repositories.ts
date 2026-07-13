// Contratos de persistencia del módulo (DIP).

import type { AsientoContable } from "./journal-entry";

export type EstadoDespacho = "pendiente" | "despachado" | "fallido";

export interface RepositorioAsientos {
  // encabezado y partidas por separado: cada uno es un paso del workflow
  // de registro, con compensación (eliminar borra en cascada)
  guardarEncabezado(asiento: AsientoContable): Promise<AsientoContable>;
  guardarPartidas(asiento: AsientoContable): Promise<void>;
  eliminar(asientoId: string): Promise<void>;
  marcarDespacho(
    asientoId: string,
    estado: EstadoDespacho,
    idExterno?: string,
  ): Promise<void>;
}
