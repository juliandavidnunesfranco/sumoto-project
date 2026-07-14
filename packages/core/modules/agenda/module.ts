// Enchufe del módulo agenda al kernel (sin suscripciones por ahora).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { ModuleDefinition } from "../../kernel/module-def";
import { RepositorioCitasSupabase } from "./infrastructure/supabase-cita-repository";
import { AgendaService } from "./service";

export const moduloAgenda: ModuleDefinition = {
  nombre: "agenda",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    registrarServicio(
      container,
      TOKENS.agendaService,
      new AgendaService(new RepositorioCitasSupabase(supabase)),
    );
  },
};
