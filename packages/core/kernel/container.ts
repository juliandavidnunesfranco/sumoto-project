// El directorio telefónico: aquí se anotan todos los servicios del sistema.
import { ContainerBuilder } from "node-dependency-injection";

// Tokens: los "nombres en el directorio". Un solo lugar para evitar strings mágicos.
export const TOKENS = {
  eventBus: "kernel.eventBus",
  // infraestructura compartida (la registra el bootstrap antes de arrancar módulos)
  supabase: "infra.supabase",
  // módulos (los irán registrando sus module.ts)
  // fachadas: UN servicio por módulo (patrón Medusa v2)
  clientesService: "modulo.clientes.service",
  originacionService: "modulo.originacion.service",
  carteraService: "modulo.cartera.service",
  contabilidadService: "modulo.contabilidad.service",
  // servicios de dominio intercambiables
  motorDecision: "modulo.originacion.motorDecision",
  // integraciones (intercambiables: mock hoy, real mañana)
  consultorRiesgo: "integracion.riesgo", // Experian
  fuenteIdentidad: "integracion.identidad", // escáner de cédula del tercero
  sistemaContable: "integracion.contable", // World Office

  reporteriaService: "modulo.reporteria.service",
  seguridadService: "modulo.seguridad.service",
  catalogoService: "modulo.catalogo.service",
  agendaService: "modulo.agenda.service",
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

// Registrar una instancia ya construida bajo un token en UN container dado.
// node-dependency-injection exige declarar el servicio como synthetic antes
// de poder inyectar la instancia con set() (semántica estilo Symfony).
export function registrarServicio(
  container: ContainerBuilder,
  token: Token,
  instancia: object,
): void {
  if (!container.hasDefinition(token)) {
    container.register(token).synthetic = true;
  }
  container.set(token, instancia);
}

// Azúcar sobre el container singleton.
export function registrar(token: Token, instancia: object): void {
  registrarServicio(getContainer(), token, instancia);
}

// Azúcar para resolver con tipo: const cartera = resolver<CarteraService>(TOKENS.carteraService)
export function resolver<T>(token: Token): T {
  return getContainer().get(token) as T;
}
