// Enchufe del módulo clientes al kernel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContainerBuilder } from "node-dependency-injection";
import { registrarServicio, TOKENS } from "../../kernel/container";
import type { EventBus } from "../../kernel/event-bus";
import type { ModuleDefinition } from "../../kernel/module-def";
import {
  EntradaManual,
  EscanerCedulaMock,
} from "../../integrations/identidad/index";
import { RegistrarCliente } from "./application/register-client";
import { RepositorioClientesSupabase } from "./infrastructure/supabase-client-repository";
import { ClientesService } from "./service";

export const moduloClientes: ModuleDefinition = {
  nombre: "clientes",

  registrar(container: ContainerBuilder): void {
    const supabase = container.get(TOKENS.supabase) as SupabaseClient;
    const bus = container.get(TOKENS.eventBus) as EventBus;

    const repositorio = new RepositorioClientesSupabase(supabase);
    // Fuentes disponibles hoy; el escáner real del tercero se agrega a esta
    // lista cuando llegue su documentación (OCP)
    const fuentes = [new EscanerCedulaMock(), new EntradaManual()];

    registrarServicio(
      container,
      TOKENS.clientesService,
      new ClientesService(
        new RegistrarCliente(fuentes, repositorio, bus),
        repositorio,
      ),
    );
  },
};
