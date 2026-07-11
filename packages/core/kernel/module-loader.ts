
// El portero: recorre los módulos, los registra y conecta sus oídos al parlante.
import { getContainer, registrar, resolver, TOKENS } from "./container";
import { EventBus } from "./event-bus";
import type { ModuleDefinition } from "./module-def";

export function arrancarKernel(modulos: ModuleDefinition[]): void {
  const container = getContainer();

  // 1. El parlante existe antes que nadie
  const bus = new EventBus();
  registrar(TOKENS.eventBus, bus);

  // 2. Primera pasada: todos se anotan en el directorio
  for (const modulo of modulos) {
    modulo.registrar(container);
    console.log(`[kernel] módulo registrado: ${modulo.nombre}`);
  }

  // 3. Segunda pasada: se conectan los oídos (ya todos existen y pueden resolverse entre sí)
  for (const modulo of modulos) {
    const subs = modulo.suscripciones?.(container) ?? [];
    for (const s of subs) {
      bus.on(s.evento, s.manejador);
      console.log(`[kernel] ${modulo.nombre} escucha "${s.evento}"`);
    }
  }
}
