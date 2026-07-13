// Fachada del módulo reporteria (patrón Medusa v2) — token modulo.reporteria.service.
// SOLO LECTURA sobre las vistas del schema reporteria: sin domain, sin escrituras
// (el equivalente al Query de Medusa). Los tipos de retorno SON su contrato.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResumenCartera {
  creditos_activos: number;
  cartera_total_centavos: number;
  cartera_vencida_centavos: number;
  icv: number | null;
}

export interface MoraPorFranja {
  franja_mora: "0-30" | "31-60" | "61-90" | "90+";
  creditos: number;
  capital_pendiente_centavos: number;
}

export interface RecaudoMensual {
  mes: string; // primer día del mes, ISO
  pagos: number;
  recaudo_centavos: number;
  mora_centavos: number;
  interes_centavos: number;
  capital_centavos: number;
}

export class ReporteriaService {
  constructor(private readonly supabase: SupabaseClient) {}

  async resumenCartera(): Promise<ResumenCartera> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("resumen_cartera")
      .select()
      .single<ResumenCartera>();
    if (error) throw new Error(`[reporteria] error leyendo resumen: ${error.message}`);
    return data;
  }

  async moraPorFranja(): Promise<MoraPorFranja[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("mora_por_franja")
      .select()
      .returns<MoraPorFranja[]>();
    if (error) throw new Error(`[reporteria] error leyendo mora: ${error.message}`);
    return data ?? [];
  }

  async recaudoMensual(limite = 6): Promise<RecaudoMensual[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("recaudo_mensual")
      .select()
      .order("mes", { ascending: false })
      .limit(limite)
      .returns<RecaudoMensual[]>();
    if (error) throw new Error(`[reporteria] error leyendo recaudo: ${error.message}`);
    return data ?? [];
  }
}
