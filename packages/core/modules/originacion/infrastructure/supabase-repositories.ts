// Implementaciones Supabase de los contratos del módulo.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Decision } from "../domain/decision";
import type { Solicitud } from "../domain/loan-application";
import type {
  RepositorioProductos,
  RepositorioSolicitudes,
} from "../domain/repositories";
import {
  aFilaSolicitudNueva,
  aProducto,
  aSolicitud,
  type FilaProducto,
  type FilaSolicitud,
} from "./mappers";

export class RepositorioProductosSupabase implements RepositorioProductos {
  constructor(private readonly supabase: SupabaseClient) {}

  async buscarPorId(id: string) {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("productos_credito")
      .select()
      .eq("id", id)
      .maybeSingle<FilaProducto>();
    if (error) throw new Error(`[originacion] error buscando producto: ${error.message}`);
    return data ? aProducto(data) : null;
  }

  async listarActivos() {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("productos_credito")
      .select()
      .eq("activo", true)
      .returns<FilaProducto[]>();
    if (error) throw new Error(`[originacion] error listando productos: ${error.message}`);
    return (data ?? []).map(aProducto);
  }
}

export class RepositorioSolicitudesSupabase implements RepositorioSolicitudes {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(solicitud: Solicitud): Promise<Solicitud> {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("solicitudes")
      .insert(aFilaSolicitudNueva(solicitud))
      .select()
      .single<FilaSolicitud>();
    if (error) throw new Error(`[originacion] error guardando solicitud: ${error.message}`);
    return aSolicitud(data);
  }

  async guardarDecision(
    solicitudId: string,
    decision: Decision,
    reporteRiesgo: unknown,
  ): Promise<void> {
    const { error } = await this.supabase
      .schema("originacion")
      .from("decisiones")
      .insert({
        solicitud_id: solicitudId,
        resultado: decision.resultado,
        razones: decision.razones,
        score: decision.score,
        reporte_riesgo: reporteRiesgo,
        cuota_estimada_centavos: decision.cuotaEstimadaCentavos,
      });
    if (error) throw new Error(`[originacion] error guardando decisión: ${error.message}`);
  }
}
