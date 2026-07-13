// Implementación Supabase del repositorio de asientos (encabezado + partidas).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AsientoContable } from "../domain/journal-entry";
import type {
  EstadoDespacho,
  RepositorioAsientos,
} from "../domain/repositories";

export class RepositorioAsientosSupabase implements RepositorioAsientos {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardarEncabezado(asiento: AsientoContable): Promise<AsientoContable> {
    const { data, error } = await this.supabase
      .schema("contabilidad")
      .from("asientos")
      .insert({
        fecha: asiento.fecha,
        descripcion: asiento.descripcion,
        evento_origen: asiento.eventoOrigen,
        referencia_id: asiento.referenciaId,
      })
      .select()
      .single<{ id: string }>();
    if (error) throw new Error(`[contabilidad] error guardando asiento: ${error.message}`);
    return { ...asiento, id: data.id };
  }

  async guardarPartidas(asiento: AsientoContable): Promise<void> {
    const { error } = await this.supabase
      .schema("contabilidad")
      .from("partidas")
      .insert(
        asiento.partidas.map((p) => ({
          asiento_id: asiento.id,
          cuenta_codigo: p.cuentaCodigo,
          cuenta_nombre: p.cuentaNombre,
          debito_centavos: p.debitoCentavos,
          credito_centavos: p.creditoCentavos,
        })),
      );
    if (error) {
      throw new Error(`[contabilidad] error guardando partidas: ${error.message}`);
    }
  }

  async eliminar(asientoId: string): Promise<void> {
    // las partidas caen por on delete cascade
    const { error } = await this.supabase
      .schema("contabilidad")
      .from("asientos")
      .delete()
      .eq("id", asientoId);
    if (error) throw new Error(`[contabilidad] error eliminando asiento: ${error.message}`);
  }

  async marcarDespacho(
    asientoId: string,
    estado: EstadoDespacho,
    idExterno?: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .schema("contabilidad")
      .from("asientos")
      .update({ despacho: estado, despacho_externo_id: idExterno ?? null })
      .eq("id", asientoId);
    if (error) throw new Error(`[contabilidad] error marcando despacho: ${error.message}`);
  }
}
