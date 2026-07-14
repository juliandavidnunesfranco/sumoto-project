// Implementación Supabase del contrato RepositorioCitas.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cita } from "../domain/cita";
import type { RepositorioCitas } from "../domain/repository";
import { aCita, aFilaNueva, type FilaCita } from "./cita-mapper";

export class RepositorioCitasSupabase implements RepositorioCitas {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(cita: Cita): Promise<Cita> {
    const { data, error } = await this.supabase
      .schema("agenda")
      .from("citas")
      .insert(aFilaNueva(cita))
      .select()
      .single<FilaCita>();

    if (error) throw new Error(`[agenda] error guardando cita: ${error.message}`);
    return aCita(data);
  }

  async entre(tiendaId: string, desdeIso: string, hastaIso: string): Promise<Cita[]> {
    const { data, error } = await this.supabase
      .schema("agenda")
      .from("citas")
      .select()
      .eq("tienda_id", tiendaId)
      .gte("fecha_hora", desdeIso)
      .lt("fecha_hora", hastaIso)
      .order("fecha_hora")
      .returns<FilaCita[]>();

    if (error) throw new Error(`[agenda] error leyendo citas: ${error.message}`);
    return (data ?? []).map(aCita);
  }

  async proximas(tiendaId: string, desdeIso: string, limite: number): Promise<Cita[]> {
    const { data, error } = await this.supabase
      .schema("agenda")
      .from("citas")
      .select()
      .eq("tienda_id", tiendaId)
      .gte("fecha_hora", desdeIso)
      .order("fecha_hora")
      .limit(limite)
      .returns<FilaCita[]>();

    if (error) throw new Error(`[agenda] error leyendo próximas citas: ${error.message}`);
    return (data ?? []).map(aCita);
  }
}
