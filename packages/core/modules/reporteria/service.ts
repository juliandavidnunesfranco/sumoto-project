// Fachada del módulo reporteria (patrón Medusa v2) — token modulo.reporteria.service.
// SOLO LECTURA sobre las vistas del schema reporteria: sin domain, sin escrituras
// (el equivalente al Query de Medusa). Los tipos de retorno SON su contrato.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CondicionBusqueda,
  type ConsultaVista,
  type MapaFiltros,
  UUID,
  aplicarFiltros,
  buscaFecha,
  buscaNumero,
  buscaTexto,
  condicionesDeBusqueda,
  filtroFechaDesde,
  filtroFechaHasta,
  filtroFechaHastaDia,
  filtroIgual,
  filtroNumero,
  filtroTexto,
  sanearTermino,
} from "./filtros";

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

// Filtros por columna que la UI puede aplicar sobre las vistas. La app los
// arma desde searchParams (crearTableQuery) y aquí cada clave se traduce a
// una condición PostgREST vía su mapa de estrategias — el mapa es la
// whitelist: clave desconocida se ignora, valor inválido también.
//
// Convenciones de valor (todo llega de la URL como string):
//   numérico    → "op:valor" con op ∈ eq|gt|gte|lt|lte (sin op = eq)
//   texto       → término libre, se sanea y aplica ilike %término%
//   fecha       → yyyy-mm-dd; "hasta" es inclusivo (lt del día siguiente)
//   igualdad    → valor exacto (opciones de un enum / id)

export interface FiltrosRecaudoMensual {
  /** Rango del mes (yyyy-mm-dd; la vista guarda el primer día del mes). */
  mesDesde?: string;
  mesHasta?: string;
  /** Comparadores "op:valor" — montos en centavos. */
  pagos?: string;
  capital?: string;
  interes?: string;
  mora?: string;
  recaudo?: string;
}

export interface FiltrosSolicitudes {
  /** Texto (ilike) sobre el id corto. */
  solicitud?: string;
  /** Texto (ilike) sobre nombre O cédula del cliente. */
  cliente?: string;
  /** Igualdad con el nombre de la moto (opciones del catálogo). */
  moto?: string;
  /** Igualdad con el user_id del vendedor (opciones de la tienda). */
  vendedor?: string;
  /** Texto (ilike) sobre el nombre del vendedor (vistas sin lista). */
  vendedorNombre?: string;
  /** Comparadores "op:centavos". */
  valor?: string;
  cuota?: string;
  /** Igualdad con el resultado del motor / estado de la solicitud. */
  decision?: string;
  estado?: string;
  /** Rango sobre creado_en (yyyy-mm-dd, hasta inclusivo). */
  desde?: string;
  hasta?: string;
}

export interface FiltrosAsientos {
  /** Texto (ilike) sobre la descripción del asiento. */
  descripcion?: string;
  /** Igualdad con el evento origen / estado de despacho. */
  origen?: string;
  despacho?: string;
  /** Comparadores "op:centavos". */
  debito?: string;
  credito?: string;
  /** Rango sobre fecha (date plana, hasta inclusivo). */
  desde?: string;
  hasta?: string;
}

export interface FiltrosCarteraTienda {
  /** Texto (ilike) sobre el nombre de la tienda. */
  tienda?: string;
  /** Comparadores "op:valor" (montos en centavos). */
  creditos?: string;
  capital?: string;
  vencido?: string;
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

// Columnas de la vista solicitudes_recientes por las que se puede ordenar
// desde la UI (el nombre viaja en la URL: whitelist obligatoria).
const COLUMNAS_ORDENABLES = new Set([
  "creado_en",
  "cliente_nombre",
  "moto_nombre",
  "vendedor_nombre",
  "valor_moto_centavos",
  "cuota_estimada_centavos",
  "decision_resultado",
  "estado",
]);

// Whitelist de orden para la vista asientos_recientes (tabla del contable).
const COLUMNAS_ASIENTOS = new Set([
  "fecha",
  "descripcion",
  "evento_origen",
  "despacho",
  "total_debito_centavos",
  "total_credito_centavos",
]);

const COLUMNAS_RECAUDO = new Set([
  "mes",
  "pagos",
  "capital_centavos",
  "interes_centavos",
  "mora_centavos",
  "recaudo_centavos",
]);

// ——— Mapas de filtros y búsqueda por vista (la maquinaria genérica vive
// en ./filtros.ts; aquí solo el CABLEADO columna→estrategia de cada vista).

const MAPA_FILTROS_RECAUDO: MapaFiltros<FiltrosRecaudoMensual> = {
  mesDesde: filtroFechaDesde("mes"),
  mesHasta: filtroFechaHastaDia("mes"),
  pagos: filtroNumero("pagos"),
  capital: filtroNumero("capital_centavos"),
  interes: filtroNumero("interes_centavos"),
  mora: filtroNumero("mora_centavos"),
  recaudo: filtroNumero("recaudo_centavos"),
};

const MAPA_FILTROS_SOLICITUDES: MapaFiltros<FiltrosSolicitudes> = {
  solicitud: filtroTexto("solicitud_corta"),
  cliente: (consulta, valor) => {
    const termino = sanearTermino(valor);
    return termino
      ? consulta.or(
          `cliente_nombre.ilike.%${termino}%,cliente_cedula.ilike.%${termino}%`,
        )
      : consulta;
  },
  moto: filtroIgual("moto_nombre"),
  // creado_por es uuid: un valor con otra forma haría 500 en PostgREST
  vendedor: (consulta, valor) =>
    UUID.test(valor) ? consulta.eq("creado_por", valor) : consulta,
  vendedorNombre: filtroTexto("vendedor_nombre"),
  valor: filtroNumero("valor_moto_centavos"),
  cuota: filtroNumero("cuota_estimada_centavos"),
  decision: filtroIgual("decision_resultado"),
  estado: filtroIgual("estado"),
  desde: filtroFechaDesde("creado_en"),
  hasta: filtroFechaHasta("creado_en"),
};

const MAPA_FILTROS_ASIENTOS: MapaFiltros<FiltrosAsientos> = {
  descripcion: filtroTexto("descripcion"),
  origen: filtroIgual("evento_origen"),
  despacho: filtroIgual("despacho"),
  debito: filtroNumero("total_debito_centavos"),
  credito: filtroNumero("total_credito_centavos"),
  desde: filtroFechaDesde("fecha"),
  hasta: filtroFechaHastaDia("fecha"), // fecha es date plana: lte directo
};

const MAPA_FILTROS_CARTERA_TIENDA: MapaFiltros<FiltrosCarteraTienda> = {
  tienda: filtroTexto("tienda_nombre"),
  creditos: filtroNumero("creditos_activos"),
  capital: filtroNumero("capital_total_centavos"),
  vencido: filtroNumero("capital_vencido_centavos"),
};

// ——— Mapas de BÚSQUEDA (input de la tabla, sobre CUALQUIER columna:
// decisión 2026-07-16): cada columna aporta su condición al or() solo si
// el término aplica a su tipo — ver ./filtros.ts.

const BUSQUEDA_RECAUDO: readonly CondicionBusqueda[] = [
  buscaFecha("mes"),
  buscaNumero("pagos"),
  buscaNumero("capital_centavos", 100),
  buscaNumero("interes_centavos", 100),
  buscaNumero("mora_centavos", 100),
  buscaNumero("recaudo_centavos", 100),
];

const BUSQUEDA_SOLICITUDES: readonly CondicionBusqueda[] = [
  buscaTexto("cliente_nombre"),
  buscaTexto("cliente_cedula"),
  buscaTexto("moto_nombre"),
  buscaTexto("vendedor_nombre"),
  buscaTexto("solicitud_corta"),
  buscaTexto("decision_resultado"),
  buscaTexto("estado"),
  buscaNumero("valor_moto_centavos", 100),
  buscaNumero("cuota_estimada_centavos", 100),
  buscaFecha("creado_en"),
];

const BUSQUEDA_ASIENTOS: readonly CondicionBusqueda[] = [
  buscaTexto("descripcion"),
  buscaTexto("evento_origen"),
  buscaTexto("despacho"),
  buscaNumero("total_debito_centavos", 100),
  buscaNumero("total_credito_centavos", 100),
  buscaFecha("fecha"),
];

const BUSQUEDA_CARTERA_TIENDA: readonly CondicionBusqueda[] = [
  buscaTexto("tienda_nombre"),
  buscaNumero("creditos_activos"),
  buscaNumero("capital_total_centavos", 100),
  buscaNumero("capital_vencido_centavos", 100),
];

// Whitelist de orden para cartera_por_tienda (tabla del ceo).
const COLUMNAS_CARTERA_TIENDA = new Set([
  "tienda_nombre",
  "creditos_activos",
  "capital_total_centavos",
  "capital_vencido_centavos",
]);

export class ReporteriaService {
  constructor(private readonly supabase: SupabaseClient) {}

  async resumenCartera(): Promise<ResumenCartera> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("resumen_cartera")
      .select()
      .single<ResumenCartera>();
    if (error)
      throw new Error(`[reporteria] error leyendo resumen: ${error.message}`);
    return data;
  }

  async moraPorFranja(): Promise<MoraPorFranja[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("mora_por_franja")
      .select()
      .returns<MoraPorFranja[]>();
    if (error)
      throw new Error(`[reporteria] error leyendo mora: ${error.message}`);
    return data ?? [];
  }
  // Recaudo con filtros genéricos: los filtros se aplican iterando el mapa
  // de estrategias (mismo patrón whitelist que el orden con COLUMNAS_RECAUDO).
  async recaudoMensual(opciones?: {
    limite?: number;
    /** Búsqueda de la tabla sobre cualquier columna (mapa de búsqueda). */
    query?: string;
    orden?: string;
    direccion?: "asc" | "desc";
    filtros?: FiltrosRecaudoMensual;
  }): Promise<RecaudoMensual[]> {
    const limite = opciones?.limite ?? 6;
    const ordenValido =
      opciones?.orden !== undefined && COLUMNAS_RECAUDO.has(opciones.orden);
    const orden = ordenValido ? opciones!.orden! : "mes";
    const ascendente = ordenValido && opciones?.direccion === "asc";

    let consulta: ConsultaVista = aplicarFiltros(
      this.supabase.schema("reporteria").from("recaudo_mensual").select(),
      MAPA_FILTROS_RECAUDO,
      opciones?.filtros,
    );

    const termino = sanearTermino(opciones?.query ?? "");
    if (termino) {
      const condiciones = condicionesDeBusqueda(BUSQUEDA_RECAUDO, termino);
      if (condiciones.length === 0) return []; // nada puede matchear
      consulta = consulta.or(condiciones.join(","));
    }

    const { data, error } = await consulta
      .order(orden, { ascending: ascendente })
      .limit(limite)
      .returns<RecaudoMensual[]>();
    if (error)
      throw new Error(`[reporteria] error leyendo recaudo: ${error.message}`);
    return data ?? [];
  }

  async carteraPorTienda(opciones?: {
    query?: string;
    orden?: string;
    direccion?: "asc" | "desc";
    filtros?: FiltrosCarteraTienda;
  }): Promise<CarteraPorTienda[]> {
    const ordenValido =
      opciones?.orden !== undefined &&
      COLUMNAS_CARTERA_TIENDA.has(opciones.orden);
    const orden = ordenValido ? opciones!.orden! : "capital_total_centavos";
    const ascendente = ordenValido && opciones?.direccion === "asc";

    let consulta: ConsultaVista = aplicarFiltros(
      this.supabase.schema("reporteria").from("cartera_por_tienda").select(),
      MAPA_FILTROS_CARTERA_TIENDA,
      opciones?.filtros,
    );

    const termino = sanearTermino(opciones?.query ?? "");
    if (termino) {
      const condiciones = condicionesDeBusqueda(
        BUSQUEDA_CARTERA_TIENDA,
        termino,
      );
      if (condiciones.length === 0) return [];
      consulta = consulta.or(condiciones.join(","));
    }

    const { data, error } = await consulta
      .order(orden, { ascending: ascendente })
      .returns<CarteraPorTienda[]>();
    if (error)
      throw new Error(
        `[reporteria] error leyendo cartera por tienda: ${error.message}`,
      );
    return data ?? [];
  }

  async solicitudesRecientes(
    opciones: { tiendaId?: string; limite?: number } = {},
  ): Promise<SolicitudReciente[]> {
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
    if (error)
      throw new Error(
        `[reporteria] error leyendo solicitudes recientes: ${error.message}`,
      );
    return data ?? [];
  }

  // Solicitudes paginadas: el vendedor acota por creadoPor, el manager por
  // tiendaId (mismo criterio que la RLS de lectura); clienteCedula filtra
  // los "casos" de un cliente concreto (vista /clientes/[cedula]); query
  // busca por nombre/cédula; los filtros POR COLUMNA viajan en `filtros`
  // y se aplican vía MAPA_FILTROS_SOLICITUDES (whitelist).
  async solicitudesPaginadas(opciones: {
    tiendaId?: string;
    creadoPor?: string;
    clienteCedula?: string;
    query?: string;
    filtros?: FiltrosSolicitudes;
    /** Alcance FIJO sobre creado_en como instantes ISO crudos (ej. el "hoy"
     *  del manager) — independiente del filtro de columna desde/hasta. */
    desdeFecha?: string;
    hastaFecha?: string;
    /** Columna de orden: SOLO nombres de la whitelist (viene de la URL). */
    orden?: string;
    direccion?: "asc" | "desc";
    pagina: number;
    porPagina: number;
  }): Promise<PaginaSolicitudes> {
    const pagina = Math.max(1, opciones.pagina);
    const porPagina = Math.max(1, opciones.porPagina);
    const desde = (pagina - 1) * porPagina;

    // whitelist de orden: el nombre llega de searchParams — jamás se
    // interpola sin validar contra columnas conocidas de la vista
    const ordenValido =
      opciones.orden !== undefined && COLUMNAS_ORDENABLES.has(opciones.orden);
    const orden = ordenValido ? opciones.orden! : "creado_en";
    const ascendente = ordenValido && opciones.direccion === "asc";

    let consulta: ConsultaVista = this.supabase
      .schema("reporteria")
      .from("solicitudes_recientes")
      .select("*", { count: "exact" })
      .order(orden, { ascending: ascendente })
      // desempate estable para que la paginación no baile entre páginas
      .order("solicitud_id", { ascending: true });
    if (opciones.tiendaId)
      consulta = consulta.eq("tienda_id", opciones.tiendaId);
    if (opciones.creadoPor)
      consulta = consulta.eq("creado_por", opciones.creadoPor);
    if (opciones.clienteCedula)
      consulta = consulta.eq("cliente_cedula", opciones.clienteCedula);
    // búsqueda multi-columna vía mapa de búsqueda (texto, montos en pesos,
    // fechas y estados); "#a1b2c3d4" busca por id corto
    const termino = sanearTermino(opciones.query?.replace(/^#/, "") ?? "");
    if (termino) {
      const condiciones = condicionesDeBusqueda(BUSQUEDA_SOLICITUDES, termino);
      if (condiciones.length === 0) return { items: [], total: 0 };
      consulta = consulta.or(condiciones.join(","));
    }
    consulta = aplicarFiltros(
      consulta,
      MAPA_FILTROS_SOLICITUDES,
      opciones.filtros,
    );
    if (opciones.desdeFecha)
      consulta = consulta.gte("creado_en", opciones.desdeFecha);
    if (opciones.hastaFecha)
      consulta = consulta.lt("creado_en", opciones.hastaFecha);

    const { data, error, count } = await consulta
      .range(desde, desde + porPagina - 1)
      .returns<SolicitudReciente[]>();
    if (error)
      throw new Error(
        `[reporteria] error paginando solicitudes: ${error.message}`,
      );
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
    if (error)
      throw new Error(`[reporteria] error leyendo desempeño: ${error.message}`);
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
    if (error)
      throw new Error(
        `[reporteria] error leyendo colocación: ${error.message}`,
      );
    return data ?? [];
  }

  // Asientos con filtros y orden por columna (tabla del contable). Mismo
  // patrón que solicitudesPaginadas: whitelist para el orden, filtros por
  // columna vía MAPA_FILTROS_ASIENTOS y búsqueda multi-columna.
  async asientosRecientes(opciones?: {
    query?: string;
    filtros?: FiltrosAsientos;
    orden?: string;
    direccion?: "asc" | "desc";
    limite?: number;
  }): Promise<AsientoReciente[]> {
    const ordenValido =
      opciones?.orden !== undefined && COLUMNAS_ASIENTOS.has(opciones.orden);
    const orden = ordenValido ? opciones!.orden! : "fecha";
    const ascendente = ordenValido && opciones?.direccion === "asc";

    let consulta: ConsultaVista = this.supabase
      .schema("reporteria")
      .from("asientos_recientes")
      .select()
      .order(orden, { ascending: ascendente })
      .order("asiento_id", { ascending: true })
      .limit(opciones?.limite ?? 20);

    consulta = aplicarFiltros(consulta, MAPA_FILTROS_ASIENTOS, opciones?.filtros);

    const termino = sanearTermino(opciones?.query ?? "");
    if (termino) {
      const condiciones = condicionesDeBusqueda(BUSQUEDA_ASIENTOS, termino);
      if (condiciones.length === 0) return [];
      consulta = consulta.or(condiciones.join(","));
    }

    const { data, error } = await consulta.returns<AsientoReciente[]>();
    if (error)
      throw new Error(`[reporteria] error leyendo asientos: ${error.message}`);
    return data ?? [];
  }
}
