// Contrato de persistencia del módulo (DIP: el dominio define, infraestructura implementa).

import type { Cliente } from "./client";

export interface RepositorioClientes {
  guardar(cliente: Cliente): Promise<Cliente>;
  buscarPorCedula(cedula: string): Promise<Cliente | null>;
  // tiendaId acota a vendedor/manager (misma regla que la RLS de lectura);
  // omitirlo es para roles de alcance nacional (financiero/contable/ceo).
  buscar(query: string, tiendaId?: string): Promise<Cliente[]>;
}
