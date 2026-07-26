// Contrato de persistencia del módulo (DIP: el dominio define, infraestructura implementa).

import type { Cliente } from "./client";

export interface RepositorioClientes {
  guardar(cliente: Cliente): Promise<Cliente>;
  buscarPorCedula(cedula: string, empresaId: string): Promise<Cliente | null>;
  buscarPorId(id: string, empresaId: string): Promise<Cliente | null>;
  // tiendaId acota a vendedor/manager (misma regla que la RLS de lectura);
  // omitirlo es para roles de alcance nacional (financiero/contable/ceo).
  // empresaId SIEMPRE se exige: cruzar el límite de empresa nunca es legítimo.
  buscar(query: string, empresaId: string, tiendaId?: string): Promise<Cliente[]>;
}
