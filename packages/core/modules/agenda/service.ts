// Fachada del módulo (patrón Medusa v2) — token modulo.agenda.service.
// Crear cita es UNA escritura simple (sin saga: no hay pasos multi-módulo
// que compensar); las lecturas alimentan calendario y banner recordatorio.

import { crearCita, type Cita, type DatosCita } from "./domain/cita";
import type { RepositorioCitas } from "./domain/repository";
import type { Resultado } from "../../kernel/result";

export class AgendaService {
  constructor(private readonly repositorio: RepositorioCitas) {}

  async crearCita(datos: DatosCita): Promise<Resultado<Cita, string[]>> {
    const creacion = crearCita(datos);
    if (!creacion.ok) return creacion;
    const guardada = await this.repositorio.guardar(creacion.valor);
    return { ok: true, valor: guardada };
  }

  citasEntre(tiendaId: string, desdeIso: string, hastaIso: string) {
    return this.repositorio.entre(tiendaId, desdeIso, hastaIso);
  }

  citasProximas(tiendaId: string, desdeIso: string, limite = 5) {
    return this.repositorio.proximas(tiendaId, desdeIso, limite);
  }
}
