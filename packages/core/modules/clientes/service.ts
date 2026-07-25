// Fachada del módulo (patrón Medusa v2): UN servicio por módulo, resuelto con
// el token modulo.clientes.service. Los casos de uso viven detrás.

import type {
  ComandoRegistrarCliente,
  RegistrarCliente,
} from "./application/register-client";
import type { RepositorioClientes } from "./domain/client-repository";

export class ClientesService {
  constructor(
    private readonly casoRegistrar: RegistrarCliente,
    private readonly repositorio: RepositorioClientes,
  ) {}

  registrarCliente(comando: ComandoRegistrarCliente) {
    return this.casoRegistrar.ejecutar(comando);
  }

  buscarPorCedula(cedula: string, empresaId: string) {
    return this.repositorio.buscarPorCedula(cedula, empresaId);
  }

  buscarPorId(id: string, empresaId: string) {
    return this.repositorio.buscarPorId(id, empresaId);
  }

  buscarClientes(query: string, empresaId: string, tiendaId?: string) {
    return this.repositorio.buscar(query, empresaId, tiendaId);
  }
}
