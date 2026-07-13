// Arranque del núcleo en el servidor. SOLO importar desde código de servidor
// (rutas API, server components, server actions): usa la llave SERVICE_ROLE.
// El cliente de Supabase NO se exporta: la app habla con el core por fachadas.

import { createClient } from "@supabase/supabase-js";
import {
  arrancarNucleo,
  resolver,
  TOKENS,
  type CarteraService,
  type ClientesService,
  type ContabilidadService,
  type OriginacionService,
  type ReporteriaService,
  type SeguridadService,
} from "@sumo/core";

const supabaseAdmin = createClient(
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
export const reporteriaService = () =>
  resolver<ReporteriaService>(TOKENS.reporteriaService);
export const seguridadService = () =>
  resolver<SeguridadService>(TOKENS.seguridadService);
