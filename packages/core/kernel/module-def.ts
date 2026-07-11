
// El contrato que todo módulo firma para poder enchufarse al sistema.
import type { ContainerBuilder } from "node-dependency-injection";
import type { EventBus } from "./event-bus";

export interface SuscripcionEvento {
  evento: string; // "cartera.pago.registrado"
  manejador: (evento: unknown) => Promise<void> | void;
}

export interface ModuleDefinition {
  nombre: string; // "clientes", "cartera"...
  registrar(container: ContainerBuilder): void; // anota sus servicios en el directorio
  suscripciones?(container: ContainerBuilder): SuscripcionEvento[]; // sus oídos
}
