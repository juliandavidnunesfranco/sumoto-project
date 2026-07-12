// Arranque del núcleo en el servidor. SOLO importar desde código de servidor
// (rutas API, server components): usa la llave SERVICE_ROLE, que jamás debe
// llegar al navegador.

import { createClient } from "@supabase/supabase-js";
import {
  arrancarNucleo,
  resolver,
  TOKENS,
  type CarteraService,
  type ClientesService,
  type ContabilidadService,
  type OriginacionService,
} from "@sumo/core";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// idempotente: aguanta HMR y múltiples evaluaciones del módulo
arrancarNucleo({ supabase: supabaseAdmin });

export const clientesService = () =>
  resolver<ClientesService>(TOKENS.clientesService);
export const originacionService = () =>
  resolver<OriginacionService>(TOKENS.originacionService);
export const carteraService = () =>
  resolver<CarteraService>(TOKENS.carteraService);
export const contabilidadService = () =>
  resolver<ContabilidadService>(TOKENS.contabilidadService);
