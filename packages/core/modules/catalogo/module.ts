// Enchufe del módulo catalogo al kernel (solo lectura: sin suscripciones).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { ModuleDefinition } from "../../kernel/module-def";
import { RepositorioMotosSupabase } from "./infrastructure/supabase-moto-repository";
import { CatalogoService } from "./service";

export const moduloCatalogo: ModuleDefinition = {
  nombre: "catalogo",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    registrarServicio(
      container,
      TOKENS.catalogoService,
      new CatalogoService(new RepositorioMotosSupabase(supabase)),
    );
  },
};
