// Enchufe del módulo cartera al kernel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { EventBus } from "../../kernel/event-bus";
import type { ModuleDefinition } from "../../kernel/module-def";
import { DesembolsarCredito } from "./application/disburse-credit";
import { DesembolsarSolicitudAprobada } from "./application/disburse-approved-application";
import type { FuenteSolicitudesAprobadas } from "./domain/approved-application-source";
import { RegistrarPago } from "./application/register-payment";
// import type: solo el TIPO cruza la frontera; en runtime la resolución es
// SIEMPRE por container (regla 3), y perezosa para no depender del orden de
// registro de módulos en el bootstrap.
import type { OriginacionService } from "../originacion";
import {
  RepositorioCreditosSupabase,
  RepositorioPagosSupabase,
} from "./infrastructure/supabase-repositories";
import { CarteraService } from "./service";

export const moduloCartera: ModuleDefinition = {
  nombre: "cartera",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    const bus = container.get(TOKENS.eventBus) as EventBus;

    const creditos = new RepositorioCreditosSupabase(supabase);
    const pagos = new RepositorioPagosSupabase(supabase);

    const fuenteSolicitudes: FuenteSolicitudesAprobadas = {
      paraDesembolso: (solicitudId) =>
        (container.get(TOKENS.originacionService) as OriginacionService)
          .paraDesembolso(solicitudId),
    };

    const casoDesembolsar = new DesembolsarCredito(creditos, bus);
    registrarServicio(
      container,
      TOKENS.carteraService,
      new CarteraService(
        casoDesembolsar,
        new RegistrarPago(creditos, pagos, bus),
        new DesembolsarSolicitudAprobada(fuenteSolicitudes, casoDesembolsar),
      ),
    );
  },
};
