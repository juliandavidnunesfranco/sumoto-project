// Enchufe del módulo originacion al kernel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { EventBus } from "../../kernel/event-bus";
import type { ModuleDefinition } from "../../kernel/module-def";
import { ExperianMock } from "../../integrations/experian/index";
import { EvaluarSolicitud } from "./application/evaluate-application";
import type { ConsultorRiesgo } from "./domain/risk-advisor";
import {
  RepositorioProductosSupabase,
  RepositorioSolicitudesSupabase,
} from "./infrastructure/supabase-repositories";
import { MotorDecisionV1 } from "./domain/decision-engine";
import { OriginacionService } from "./service";
import { alDesembolsarCredito } from "./subscribers/on-credit-disbursed";

export const moduloOriginacion: ModuleDefinition = {
  nombre: "originacion",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    const bus = container.get(TOKENS.eventBus) as EventBus;

    // Mock hoy; Experian real mañana bajo el mismo token (LSP)
    const consultorRiesgo: ConsultorRiesgo = new ExperianMock();
    registrarServicio(container, TOKENS.consultorRiesgo, consultorRiesgo);

    // Motor v1 intercambiable: motor v2/ML o "motor sombra" bajo el mismo token
    const motor = new MotorDecisionV1();
    registrarServicio(container, TOKENS.motorDecision, motor);

    const productos = new RepositorioProductosSupabase(supabase);
    registrarServicio(
      container,
      TOKENS.originacionService,
      new OriginacionService(
        new EvaluarSolicitud(
          productos,
          new RepositorioSolicitudesSupabase(supabase),
          consultorRiesgo,
          motor,
          bus,
        ),
        productos,
      ),
    );
  },

  suscripciones(container: ContainerBuilder) {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    return [
      {
        evento: "cartera.credito.desembolsado",
        manejador: alDesembolsarCredito(
          new RepositorioSolicitudesSupabase(supabase),
        ),
      },
    ];
  },
};
