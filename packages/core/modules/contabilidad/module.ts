// Enchufe del módulo contabilidad al kernel: es casi puro oído.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { TOKENS } from "../../kernel/container";
import type { ModuleDefinition } from "../../kernel/module-def";
import { WorldOfficeMock } from "../../integrations/world-office/index";
import { RegistrarAsiento } from "./application/record-entry";
import type { SistemaContable } from "./domain/accounting-system";
import { RepositorioAsientosSupabase } from "./infrastructure/supabase-entry-repository";
import {
  alDesembolsarCredito,
  alRegistrarPago,
} from "./subscribers/on-cartera-events";

function armarRegistrador(container: ContainerBuilder): RegistrarAsiento {
  const supabase = container.get(TOKENS.supabase) as SupabaseClient;
  const sistemaContable = container.get(TOKENS.sistemaContable) as SistemaContable;
  return new RegistrarAsiento(
    new RepositorioAsientosSupabase(supabase),
    sistemaContable,
  );
}

export const moduloContabilidad: ModuleDefinition = {
  nombre: "contabilidad",

  registrar(container: ContainerBuilder): void {
    // Mock hoy; World Office real mañana bajo el mismo token (LSP)
    container.set(TOKENS.sistemaContable, new WorldOfficeMock());
    container.set(TOKENS.contabilidadService, armarRegistrador(container));
  },

  suscripciones(container: ContainerBuilder) {
    const registrar = container.get(
      TOKENS.contabilidadService,
    ) as RegistrarAsiento;
    return [
      {
        evento: "cartera.credito.desembolsado",
        manejador: alDesembolsarCredito(registrar),
      },
      {
        evento: "cartera.pago.registrado",
        manejador: alRegistrarPago(registrar),
      },
    ];
  },
};
