// Fachada del módulo (patrón Medusa v2): UN servicio por módulo, resuelto con
// el token modulo.clientes.service. Los casos de uso viven detrás.

import type {
  ComandoRegistrarCliente,
  RegistrarCliente,
} from "./application/register-client";

export class ClientesService {
  constructor(private readonly casoRegistrar: RegistrarCliente) {}

  registrarCliente(comando: ComandoRegistrarCliente) {
    return this.casoRegistrar.ejecutar(comando);
  }
}
