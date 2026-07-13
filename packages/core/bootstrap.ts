// Arranque del núcleo: registra la infraestructura compartida y enciende los
// módulos. Lo llaman las apps (una vez) antes de resolver cualquier servicio.

import { arrancarKernel } from "./kernel/module-loader";
import { registrar, TOKENS } from "./kernel/container";
import { moduloClientes } from "./modules/clientes/index";
import { moduloOriginacion } from "./modules/originacion/index";
import { moduloCartera } from "./modules/cartera/index";
import { moduloContabilidad } from "./modules/contabilidad/index";
import { moduloReporteria } from "./modules/reporteria/index";
import { moduloSeguridad } from "./modules/seguridad/index";

let arrancado = false;

// Decisión 2026-07-12: `supabase` debe ser un cliente SERVICE_ROLE creado en el
// servidor (jamás expuesto al navegador). La seguridad de la app va en dos
// puertas: middleware de roles (pantallas) + validación de rol/tienda en rutas;
// RLS protege el acceso directo a PostgREST. Backlog: cliente por request con
// JWT del usuario para RLS de punta a punta.
export function arrancarNucleo(deps: { supabase: object }): void {
  // Next.js puede evaluar el módulo varias veces (HMR, rutas): arranque idempotente
  if (arrancado) return;
  registrar(TOKENS.supabase, deps.supabase);
  arrancarKernel([
    moduloClientes,
    moduloOriginacion,
    moduloCartera,
    moduloContabilidad,
    moduloReporteria,
    moduloSeguridad,
  ]);
  arrancado = true;
}
