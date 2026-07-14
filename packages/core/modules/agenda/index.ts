// ÚNICA puerta importable del módulo agenda (regla 2).

export type { Cita, DatosCita, TipoCita } from "./domain/cita";
export type { RepositorioCitas } from "./domain/repository";
export { AgendaService } from "./service";
export { moduloAgenda } from "./module";
