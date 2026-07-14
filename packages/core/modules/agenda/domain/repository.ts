// Contrato de persistencia del módulo (DIP: el dominio define).

import type { Cita } from "./cita";

export interface RepositorioCitas {
  guardar(cita: Cita): Promise<Cita>;
  /** Citas de una tienda dentro de un rango [desde, hasta), ordenadas. */
  entre(tiendaId: string, desdeIso: string, hastaIso: string): Promise<Cita[]>;
  /** Próximas citas desde un instante dado (para el banner recordatorio). */
  proximas(tiendaId: string, desdeIso: string, limite: number): Promise<Cita[]>;
}
