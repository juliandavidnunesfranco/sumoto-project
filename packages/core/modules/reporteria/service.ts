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

export interface CarteraPorTienda {
  tienda_id: string;
  tienda_nombre: string;
  creditos_activos: number;
  capital_total_centavos: number;
  capital_vencido_centavos: number;
}

export interface SolicitudReciente {
  solicitud_id: string;
  tienda_id: string;
  creado_en: string;
  valor_moto_centavos: number;
  estado: string;
  cliente_nombre: string | null;
  decision_resultado: string | null;
  cuota_estimada_centavos: number | null;
  cliente_cedula: string | null;
  cliente_telefono: string | null;
  plazo_meses: number;
  creado_por: string;
  moto_nombre: string | null;
  vendedor_nombre: string | null;
  solicitud_corta: string;
}

export interface PaginaSolicitudes {
  items: SolicitudReciente[];
  total: number;
}

export interface DesempenoVendedor {
  tienda_id: string;
  creado_por: string;
  vendedor_nombre: string;
  solicitudes: number;
  aprobadas: number;
  colocacion_centavos: number;
}

export interface ColocacionDia {
  tienda_id: string;
  fecha: string;
  creditos: number;
  monto_centavos: number;
}

export interface AsientoReciente {
  asiento_id: string;
  fecha: string;
  descripcion: string;
  evento_origen: string;
  despacho: string;
  total_debito_centavos: number;
  total_credito_centavos: number;
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

  async carteraPorTienda(): Promise<CarteraPorTienda[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("cartera_por_tienda")
      .select()
      .order("capital_total_centavos", { ascending: false })
      .returns<CarteraPorTienda[]>();
    if (error) throw new Error(`[reporteria] error leyendo cartera por tienda: ${error.message}`);
    return data ?? [];
  }

  async solicitudesRecientes(opciones: { tiendaId?: string; limite?: number } = {}): Promise<
    SolicitudReciente[]
  > {
    let consulta = this.supabase
      .schema("reporteria")
      .from("solicitudes_recientes")
      .select()
      // el ORDER BY de la vista no sobrevive a PostgREST: se pide explícito
      .order("creado_en", { ascending: false })
      .limit(opciones.limite ?? 20);
    if (opciones.tiendaId) {
      consulta = consulta.eq("tienda_id", opciones.tiendaId);
    }
    const { data, error } = await consulta.returns<SolicitudReciente[]>();
    if (error) throw new Error(`[reporteria] error leyendo solicitudes recientes: ${error.message}`);
    return data ?? [];
  }

  // Solicitudes paginadas: el vendedor acota por creadoPor, el manager por
  // tiendaId (mismo criterio que la RLS de lectura); clienteCedula filtra
  // los "casos" de un cliente concreto (vista /clientes/[cedula]); query
  // busca por nombre/cédula y decision filtra por resultado del motor.
  async solicitudesPaginadas(opciones: {
    tiendaId?: string;
    creadoPor?: string;
    clienteCedula?: string;
    query?: string;
    decision?: string;
    estado?: string;
    moto?: string;
    /** Rango sobre creado_en (ISO yyyy-mm-dd). */
    desdeFecha?: string;
    hastaFecha?: string;
    pagina: number;
    porPagina: number;
  }): Promise<PaginaSolicitudes> {
    const pagina = Math.max(1, opciones.pagina);
    const porPagina = Math.max(1, opciones.porPagina);
    const desde = (pagina - 1) * porPagina;

    let consulta = this.supabase
      .schema("reporteria")
      .from("solicitudes_recientes")
      .select("*", { count: "exact" })
      .order("creado_en", { ascending: false });
    if (opciones.tiendaId) consulta = consulta.eq("tienda_id", opciones.tiendaId);
    if (opciones.creadoPor) consulta = consulta.eq("creado_por", opciones.creadoPor);
    if (opciones.clienteCedula) consulta = consulta.eq("cliente_cedula", opciones.clienteCedula);
    // búsqueda multi-columna: cliente, cédula, moto, vendedor e id corto
    // ("#a1b2c3d4"); saneo de metacaracteres del filtro PostgREST antes de
    // interpolar en .or() — misma regla anti-inyección que en clientes
    const query = opciones.query?.trim().replace(/^#/, "").replace(/[,()*\\."']/g, "");
    if (query) {
      consulta = consulta.or(
        [
          `cliente_nombre.ilike.%${query}%`,
          `cliente_cedula.ilike.%${query}%`,
          `moto_nombre.ilike.%${query}%`,
          `vendedor_nombre.ilike.%${query}%`,
          `solicitud_corta.ilike.%${query}%`,
        ].join(","),
      );
    }
    if (opciones.decision) consulta = consulta.eq("decision_resultado", opciones.decision);
    if (opciones.estado) consulta = consulta.eq("estado", opciones.estado);
    if (opciones.moto) consulta = consulta.eq("moto_nombre", opciones.moto);
    if (opciones.desdeFecha) consulta = consulta.gte("creado_en", opciones.desdeFecha);
    if (opciones.hastaFecha) consulta = consulta.lt("creado_en", opciones.hastaFecha);

    const { data, error, count } = await consulta
      .range(desde, desde + porPagina - 1)
      .returns<SolicitudReciente[]>();
    if (error) throw new Error(`[reporteria] error paginando solicitudes: ${error.message}`);
    return { items: data ?? [], total: count ?? 0 };
  }

  // Desempeño del equipo de una tienda (tabla del manager, estilo v0).
  async desempenoVendedores(tiendaId: string): Promise<DesempenoVendedor[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("desempeno_vendedores")
      .select()
      .eq("tienda_id", tiendaId)
      .order("colocacion_centavos", { ascending: false })
      .returns<DesempenoVendedor[]>();
    if (error) throw new Error(`[reporteria] error leyendo desempeño: ${error.message}`);
    return data ?? [];
  }

  // Serie diaria de colocación de una tienda (seguimiento del manager:
  // el gráfico mensual y el calendario agregan encima de esta serie).
  async colocacionDiaria(
    tiendaId: string,
    desdeIso?: string,
    hastaIso?: string,
  ): Promise<ColocacionDia[]> {
    let consulta = this.supabase
      .schema("reporteria")
      .from("colocacion_diaria")
      .select()
      .eq("tienda_id", tiendaId)
      .order("fecha");
    if (desdeIso) consulta = consulta.gte("fecha", desdeIso);
    if (hastaIso) consulta = consulta.lt("fecha", hastaIso);
    const { data, error } = await consulta.returns<ColocacionDia[]>();
    if (error) throw new Error(`[reporteria] error leyendo colocación: ${error.message}`);
    return data ?? [];
  }

  async asientosRecientes(limite = 20): Promise<AsientoReciente[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("asientos_recientes")
      .select()
      .limit(limite)
      .returns<AsientoReciente[]>();
    if (error) throw new Error(`[reporteria] error leyendo asientos: ${error.message}`);
    return data ?? [];
  }
}
