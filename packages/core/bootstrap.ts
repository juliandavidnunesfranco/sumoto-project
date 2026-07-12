// Arranque del núcleo: registra la infraestructura compartida y enciende los
// módulos. Lo llaman las apps (una vez) antes de resolver cualquier servicio.

import { arrancarKernel } from "./kernel/module-loader";
import { registrar, TOKENS } from "./kernel/container";
import { moduloClientes } from "./modules/clientes/index";
import { moduloOriginacion } from "./modules/originacion/index";
import { moduloCartera } from "./modules/cartera/index";
import { moduloContabilidad } from "./modules/contabilidad/index";

let arrancado = false;

export function arrancarNucleo(deps: { supabase: object }): void {
  // Next.js puede evaluar el módulo varias veces (HMR, rutas): arranque idempotente
  if (arrancado) return;
  registrar(TOKENS.supabase, deps.supabase);
  arrancarKernel([
    moduloClientes,
    moduloOriginacion,
    moduloCartera,
    moduloContabilidad,
  ]);
  arrancado = true;
}
