// Enchufe del módulo seguridad al kernel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { ModuleDefinition } from "../../kernel/module-def";
import { RepositorioPerfilesSupabase } from "./infrastructure/supabase-profile-repository";
import { SeguridadService } from "./service";

export const moduloSeguridad: ModuleDefinition = {
  nombre: "seguridad",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    registrarServicio(
      container,
      TOKENS.seguridadService,
      new SeguridadService(new RepositorioPerfilesSupabase(supabase)),
    );
  },
};
