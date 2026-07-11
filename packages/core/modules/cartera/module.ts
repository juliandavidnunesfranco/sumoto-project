// Enchufe del módulo cartera al kernel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { TOKENS } from "../../kernel/container";
import type { EventBus } from "../../kernel/event-bus";
import type { ModuleDefinition } from "../../kernel/module-def";
import { DesembolsarCredito } from "./application/disburse-credit";
import { RegistrarPago } from "./application/register-payment";
import {
  RepositorioCreditosSupabase,
  RepositorioPagosSupabase,
} from "./infrastructure/supabase-repositories";

export const moduloCartera: ModuleDefinition = {
  nombre: "cartera",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    const bus = container.get(TOKENS.eventBus) as EventBus;

    const creditos = new RepositorioCreditosSupabase(supabase);
    const pagos = new RepositorioPagosSupabase(supabase);

    container.set(TOKENS.desembolsarCredito, new DesembolsarCredito(creditos, bus));
    container.set(TOKENS.registrarPago, new RegistrarPago(creditos, pagos, bus));
  },
};
