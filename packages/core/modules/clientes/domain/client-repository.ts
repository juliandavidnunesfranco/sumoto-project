// Contrato de persistencia del módulo (DIP: el dominio define, infraestructura implementa).

import type { Cliente } from "./client";

export interface RepositorioClientes {
  guardar(cliente: Cliente): Promise<Cliente>;
  buscarPorCedula(cedula: string): Promise<Cliente | null>;
}
