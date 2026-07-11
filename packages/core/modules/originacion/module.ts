// Enchufe del módulo originacion al kernel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { TOKENS } from "../../kernel/container";
import type { EventBus } from "../../kernel/event-bus";
import type { ModuleDefinition } from "../../kernel/module-def";
import { ExperianMock } from "../../integrations/experian/index";
import { EvaluarSolicitud } from "./application/evaluate-application";
import type { ConsultorRiesgo } from "./domain/risk-advisor";
import {
  RepositorioProductosSupabase,
  RepositorioSolicitudesSupabase,
} from "./infrastructure/supabase-repositories";

export const moduloOriginacion: ModuleDefinition = {
  nombre: "originacion",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    const bus = container.get(TOKENS.eventBus) as EventBus;

    // Mock hoy; Experian real mañana bajo el mismo token (LSP)
    const consultorRiesgo: ConsultorRiesgo = new ExperianMock();
    container.set(TOKENS.consultorRiesgo, consultorRiesgo);

    container.set(
      TOKENS.originacionService,
      new EvaluarSolicitud(
        new RepositorioProductosSupabase(supabase),
        new RepositorioSolicitudesSupabase(supabase),
        consultorRiesgo,
        bus,
      ),
    );
  },
};
