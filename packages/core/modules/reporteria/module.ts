// Enchufe del módulo reporteria al kernel (solo lectura: sin suscripciones).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { ModuleDefinition } from "../../kernel/module-def";
import { ReporteriaService } from "./service";

export const moduloReporteria: ModuleDefinition = {
  nombre: "reporteria",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    registrarServicio(
      container,
      TOKENS.reporteriaService,
      new ReporteriaService(supabase),
    );
  },
};
