// El directorio telefónico: aquí se anotan todos los servicios del sistema.
import { ContainerBuilder } from "node-dependency-injection";

// Tokens: los "nombres en el directorio". Un solo lugar para evitar strings mágicos.
export const TOKENS = {
  eventBus: "kernel.eventBus",
  // infraestructura compartida (la registra el bootstrap antes de arrancar módulos)
  supabase: "infra.supabase",
  // módulos (los irán registrando sus module.ts)
  clientesService: "modulo.clientes.service",
  originacionService: "modulo.originacion.service",
  carteraService: "modulo.cartera.service",
  contabilidadService: "modulo.contabilidad.service",
  // integraciones (intercambiables: mock hoy, real mañana)
  consultorRiesgo: "integracion.riesgo", // Experian
  fuenteIdentidad: "integracion.identidad", // escáner de cédula del tercero
  sistemaContable: "integracion.contable", // World Office
} as const;

export type Token = (typeof TOKENS)[keyof typeof TOKENS];

// Una sola instancia del contenedor para toda la app (singleton).
let builder: ContainerBuilder | null = null;

export function getContainer(): ContainerBuilder {
  if (!builder) {
    builder = new ContainerBuilder();
  }
  return builder;
}

// Azúcar para registrar una instancia ya construida bajo un token.
export function registrar(token: Token, instancia: object): void {
  getContainer().set(token, instancia);
}

// Azúcar para resolver con tipo: const cartera = resolver<CarteraService>(TOKENS.carteraService)
export function resolver<T>(token: Token): T {
  return getContainer().get(token) as T;
}
