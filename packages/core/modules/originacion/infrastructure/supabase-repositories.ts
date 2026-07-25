// Implementaciones Supabase de los contratos del módulo.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Decision } from "../domain/decision";
import type { Solicitud } from "../domain/loan-application";
import type {
  AlmacenDocumentos,
  DocumentoExpediente,
  MarcaVerificacion,
  RepositorioProductos,
  RepositorioSolicitudes,
  RepositorioVerificaciones,
} from "../domain/repositories";
import type { ProductoCredito } from "../domain/credit-product";
import {
  aFilaProductoNueva,
  aFilaReglasJson,
  aFilaSolicitudNueva,
  aProducto,
  aSolicitud,
  type FilaProducto,
  type FilaSolicitud,
} from "./mappers";

export class RepositorioProductosSupabase implements RepositorioProductos {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(producto: Omit<ProductoCredito, "id">): Promise<ProductoCredito> {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("productos_credito")
      .insert(aFilaProductoNueva(producto))
      .select()
      .single<FilaProducto>();
    if (error) throw new Error(`[originacion] error guardando producto: ${error.message}`);
    return aProducto(data);
  }

  async actualizarReglas(producto: ProductoCredito): Promise<ProductoCredito> {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("productos_credito")
      .update({ reglas_decision: aFilaReglasJson(producto.reglasDecision) })
      .eq("id", producto.id)
      .select()
      .single<FilaProducto>();
    if (error) throw new Error(`[originacion] error actualizando reglas: ${error.message}`);
    return aProducto(data);
  }

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
    // orden estable por antigüedad: el submenú del sidebar y el select del
    // wizard muestran siempre la misma secuencia
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("productos_credito")
      .select()
      .eq("activo", true)
      .order("creado_en", { ascending: true })
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

  async actualizarEstado(
    solicitudId: string,
    estado: Solicitud["estado"],
  ): Promise<void> {
    const { error } = await this.supabase
      .schema("originacion")
      .from("solicitudes")
      .update({ estado })
      .eq("id", solicitudId);
    if (error) throw new Error(`[originacion] error actualizando estado: ${error.message}`);
  }

  async buscarPorId(solicitudId: string): Promise<Solicitud | null> {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("solicitudes")
      .select()
      .eq("id", solicitudId)
      .maybeSingle<FilaSolicitud>();
    if (error) throw new Error(`[originacion] error buscando solicitud: ${error.message}`);
    return data ? aSolicitud(data) : null;
  }

  async buscarDecision(solicitudId: string): Promise<Decision | null> {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("decisiones")
      .select("resultado, razones, score, cuota_estimada_centavos")
      .eq("solicitud_id", solicitudId)
      .order("evaluado_en", { ascending: false })
      .limit(1)
      .maybeSingle<{
        resultado: Decision["resultado"];
        razones: string[];
        score: number | null;
        cuota_estimada_centavos: number | null;
      }>();
    if (error) throw new Error(`[originacion] error buscando decisión: ${error.message}`);
    return data
      ? {
          resultado: data.resultado,
          razones: data.razones ?? [],
          score: data.score ?? 0,
          cuotaEstimadaCentavos: Number(data.cuota_estimada_centavos ?? 0),
        }
      : null;
  }

  async eliminar(solicitudId: string): Promise<void> {
    const { error } = await this.supabase
      .schema("originacion")
      .from("solicitudes")
      .delete()
      .eq("id", solicitudId);
    if (error) throw new Error(`[originacion] error eliminando solicitud: ${error.message}`);
  }

  async eliminarDecisiones(solicitudId: string): Promise<void> {
    const { error } = await this.supabase
      .schema("originacion")
      .from("decisiones")
      .delete()
      .eq("solicitud_id", solicitudId);
    if (error) throw new Error(`[originacion] error eliminando decisiones: ${error.message}`);
  }

  async reporteDeRiesgo(solicitudId: string): Promise<unknown | null> {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("decisiones")
      .select("reporte_riesgo")
      .eq("solicitud_id", solicitudId)
      .order("evaluado_en", { ascending: false })
      .limit(1)
      .maybeSingle<{ reporte_riesgo: unknown }>();
    if (error) throw new Error(`[originacion] error leyendo reporte de riesgo: ${error.message}`);
    return data?.reporte_riesgo ?? null;
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

export class RepositorioVerificacionesSupabase implements RepositorioVerificaciones {
  constructor(private readonly supabase: SupabaseClient) {}

  async marcar(
    solicitudId: string,
    itemCodigo: string,
    marcado: boolean,
    marcadoPor: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .schema("originacion")
      .from("verificaciones")
      .upsert(
        {
          solicitud_id: solicitudId,
          item_codigo: itemCodigo,
          marcado,
          marcado_por: marcadoPor,
          marcado_en: new Date().toISOString(),
        },
        { onConflict: "solicitud_id,item_codigo" },
      );
    if (error) throw new Error(`[originacion] error marcando verificación: ${error.message}`);
  }

  async marcasDe(solicitudId: string): Promise<MarcaVerificacion[]> {
    const { data, error } = await this.supabase
      .schema("originacion")
      .from("verificaciones")
      .select("item_codigo, marcado, marcado_por, marcado_en")
      .eq("solicitud_id", solicitudId)
      .returns<
        { item_codigo: string; marcado: boolean; marcado_por: string; marcado_en: string }[]
      >();
    if (error) throw new Error(`[originacion] error leyendo verificaciones: ${error.message}`);
    return (data ?? []).map((f) => ({
      itemCodigo: f.item_codigo,
      marcado: f.marcado,
      marcadoPor: f.marcado_por,
      marcadoEn: f.marcado_en,
    }));
  }
}

// Documentos del expediente en Supabase Storage (bucket PRIVADO `documentos`,
// un prefijo por solicitud). El formato externo muere aquí: hacia el dominio
// solo viajan nombres, bytes y mime.
const BUCKET_DOCUMENTOS = "documentos";

export class AlmacenDocumentosSupabase implements AlmacenDocumentos {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(
    solicitudId: string,
    nombre: string,
    contenido: ArrayBuffer,
    mime: string,
  ): Promise<void> {
    const { error } = await this.supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(`${solicitudId}/${nombre}`, contenido, { contentType: mime, upsert: true });
    if (error) throw new Error(`[originacion] error subiendo documento: ${error.message}`);
  }

  async listar(solicitudId: string): Promise<DocumentoExpediente[]> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .list(solicitudId, { sortBy: { column: "created_at", order: "asc" } });
    if (error) throw new Error(`[originacion] error listando documentos: ${error.message}`);
    return (data ?? [])
      .filter((o) => o.name !== ".emptyFolderPlaceholder")
      .map((o) => ({
        nombre: o.name,
        tamanoBytes: (o.metadata as { size?: number } | null)?.size ?? 0,
        creadoEn: o.created_at ?? "",
      }));
  }

  async descargar(
    solicitudId: string,
    nombre: string,
  ): Promise<{ contenido: ArrayBuffer; mime: string } | null> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .download(`${solicitudId}/${nombre}`);
    if (error) {
      if (error.message.toLowerCase().includes("not found")) return null;
      throw new Error(`[originacion] error descargando documento: ${error.message}`);
    }
    return { contenido: await data.arrayBuffer(), mime: data.type };
  }
}
