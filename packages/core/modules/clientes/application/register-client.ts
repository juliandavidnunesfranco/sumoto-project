// Caso de uso: registrar un cliente desde una fuente de identidad
// (escáner de cédula o entrada manual — mismo contrato, regla OCP).

import type { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import type { FuenteDeDatos } from "../domain/citizen-data";
import { crearCliente, type Cliente } from "../domain/client";
import type { RepositorioClientes } from "../domain/client-repository";
import type { FuenteIdentidad } from "../domain/identity-source";

export interface ComandoRegistrarCliente {
  fuente: FuenteDeDatos;
  entradaCruda: unknown; // payload tal como llega de afuera; lo traduce la fuente
  ingresosDeclaradosCentavos?: number;
  tiendaId: string;
  empresaId: string;
}

export class RegistrarCliente {
  constructor(
    private readonly fuentes: FuenteIdentidad[],
    private readonly repositorio: RepositorioClientes,
    private readonly bus: EventBus,
  ) {}

  async ejecutar(
    comando: ComandoRegistrarCliente,
  ): Promise<Resultado<Cliente, string[]>> {
    const fuente = this.fuentes.find((f) => f.nombre === comando.fuente);
    if (!fuente) {
      return fallo([`fuente de identidad desconocida: ${comando.fuente}`]);
    }

    const captura = await fuente.capturar(comando.entradaCruda);
    if (!captura.ok) {
      return fallo([captura.error]);
    }

    // Idempotencia por cédula ACOTADA a la empresa: dos empresas distintas
    // pueden tener cada una un cliente con la misma cédula (personas
    // distintas registradas por negocios distintos, o el mismo cliente
    // real siendo sujeto de crédito en dos empresas independientes).
    const existente = await this.repositorio.buscarPorCedula(
      captura.valor.cedula,
      comando.empresaId,
    );
    if (existente) {
      return exito(existente);
    }

    const creacion = crearCliente(captura.valor, {
      ingresosDeclaradosCentavos: comando.ingresosDeclaradosCentavos,
      fuenteIdentidad: fuente.nombre,
      tiendaId: comando.tiendaId,
      empresaId: comando.empresaId,
    });
    if (!creacion.ok) {
      return creacion;
    }

    const guardado = await this.repositorio.guardar(creacion.valor);

    await this.bus.emit("clientes.cliente.registrado", {
      clienteId: guardado.id,
      cedula: guardado.cedula,
      tiendaId: guardado.tiendaId,
    });

    return exito(guardado);
  }
}
