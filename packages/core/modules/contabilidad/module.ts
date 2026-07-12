// Enchufe del módulo contabilidad al kernel: es casi puro oído.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { ModuleDefinition } from "../../kernel/module-def";
import { WorldOfficeMock } from "../../integrations/world-office/index";
import { RegistrarAsiento } from "./application/record-entry";
import type { SistemaContable } from "./domain/accounting-system";
import { RepositorioAsientosSupabase } from "./infrastructure/supabase-entry-repository";
import { ContabilidadService } from "./service";
import {
  alDesembolsarCredito,
  alRegistrarPago,
} from "./subscribers/on-cartera-events";

function armarServicio(container: ContainerBuilder): ContabilidadService {
  const supabase = container.get(TOKENS.supabase) as SupabaseClient;
  const sistemaContable = container.get(TOKENS.sistemaContable) as SistemaContable;
  return new ContabilidadService(
    new RegistrarAsiento(
      new RepositorioAsientosSupabase(supabase),
      sistemaContable,
    ),
  );
}

export const moduloContabilidad: ModuleDefinition = {
  nombre: "contabilidad",

  registrar(container: ContainerBuilder): void {
    // Mock hoy; World Office real mañana bajo el mismo token (LSP)
    registrarServicio(container, TOKENS.sistemaContable, new WorldOfficeMock());
    registrarServicio(container, TOKENS.contabilidadService, armarServicio(container));
  },

  suscripciones(container: ContainerBuilder) {
    const registrar = container.get(
      TOKENS.contabilidadService,
    ) as ContabilidadService;
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
