// Maquinaria genérica de filtros y búsqueda de reporteria (INTERNA del
// módulo — no se exporta por index.ts). Dos piezas hermanas por vista:
//
//   MAPA DE FILTROS  — filtro por columna: cada clave de la interface de
//     filtros sabe traducirse a una condición PostgREST. El mapa ES la
//     whitelist: clave desconocida de la URL se ignora, valor malformado
//     (NaN, fecha inválida, uuid deforme) también — jamás revienta.
//
//   MAPA DE BÚSQUEDA — búsqueda multi-columna de la tabla: cada estrategia
//     devuelve un fragmento or() de PostgREST si el término aplica a su
//     columna según el TIPO (texto→ilike, número→eq, fecha→rango), o null.
//     Término que ninguna estrategia acepta = resultado vacío.
//
// Convenciones de valor (todo llega de la URL como string):
//   numérico → "op:valor" con op ∈ eq|gt|gte|lt|lte (sin op = eq)
//   texto    → término libre, se sanea y aplica ilike %término%
//   fecha    → yyyy-mm-dd; "hasta" es inclusivo
//   igualdad → valor exacto (opciones de un enum / id)

import type { SupabaseClient } from "@supabase/supabase-js";
import { agregarMeses, diaSiguiente } from "../../shared/dates";

// Builder de PostgREST tras .select(): el tipo se deriva del propio cliente
// para no depender de @supabase/postgrest-js (dependencia transitiva).
export type ConsultaVista = ReturnType<
  ReturnType<ReturnType<SupabaseClient["schema"]>["from"]>["select"]
>;

export type EstrategiaFiltro = (
  consulta: ConsultaVista,
  valor: string,
) => ConsultaVista;

// El mapped type obliga a que interface de filtros y mapa no se
// desincronicen: campo nuevo sin estrategia (o al revés) = error de tipos.
export type MapaFiltros<F> = { [K in keyof Required<F>]: EstrategiaFiltro };

// misma regla anti-inyección que siempre: fuera los metacaracteres del
// filtro PostgREST antes de interpolar en ilike/or
export function sanearTermino(valor: string): string {
  return valor.trim().replace(/[,()*\\."']/g, "");
}

export const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ——— Estrategias de FILTRO por columna ————————————————————————————————

export const filtroTexto =
  (columna: string): EstrategiaFiltro =>
  (consulta, valor) => {
    const termino = sanearTermino(valor);
    return termino ? consulta.ilike(columna, `%${termino}%`) : consulta;
  };

export const filtroIgual =
  (columna: string): EstrategiaFiltro =>
  (consulta, valor) =>
    consulta.eq(columna, valor);

// "op:valor" con whitelist de operadores; valor no numérico se ignora.
export const filtroNumero =
  (columna: string): EstrategiaFiltro =>
  (consulta, valor) => {
    const [op, crudo] = valor.includes(":")
      ? (valor.split(":", 2) as [string, string])
      : ["eq", valor];
    const numero = Number(crudo);
    if (!Number.isFinite(numero)) return consulta;
    switch (op) {
      case "gt":
        return consulta.gt(columna, numero);
      case "gte":
        return consulta.gte(columna, numero);
      case "lt":
        return consulta.lt(columna, numero);
      case "lte":
        return consulta.lte(columna, numero);
      case "eq":
        return consulta.eq(columna, numero);
      default:
        return consulta; // operador fuera de la whitelist
    }
  };

export const filtroFechaDesde =
  (columna: string): EstrategiaFiltro =>
  (consulta, valor) =>
    FECHA_ISO.test(valor) ? consulta.gte(columna, valor) : consulta;

// "hasta" inclusivo: lt del día siguiente (columnas timestamptz).
export const filtroFechaHasta =
  (columna: string): EstrategiaFiltro =>
  (consulta, valor) =>
    FECHA_ISO.test(valor) ? consulta.lt(columna, diaSiguiente(valor)) : consulta;

// "hasta" inclusivo sobre columnas date (lte directo, sin día siguiente).
export const filtroFechaHastaDia =
  (columna: string): EstrategiaFiltro =>
  (consulta, valor) =>
    FECHA_ISO.test(valor) ? consulta.lte(columna, valor) : consulta;

export function aplicarFiltros<F extends object>(
  consulta: ConsultaVista,
  mapa: MapaFiltros<F>,
  filtros: F | undefined,
): ConsultaVista {
  for (const [campo, valor] of Object.entries(filtros ?? {})) {
    const aplicar = mapa[campo as keyof F];
    if (aplicar && typeof valor === "string" && valor) {
      consulta = aplicar(consulta, valor);
    }
  }
  return consulta;
}

// ——— Estrategias de BÚSQUEDA multi-columna ————————————————————————————
// Devuelven un fragmento para .or() de PostgREST, o null si el término no
// aplica al tipo de la columna. El término llega YA saneado.

export type CondicionBusqueda = (termino: string) => string | null;

export const buscaTexto =
  (columna: string): CondicionBusqueda =>
  (termino) =>
    `${columna}.ilike.%${termino}%`;

// factor traduce lo que escribe el usuario a la unidad de la vista
// (100 = pesos → centavos); término no numérico no aplica.
// Con factor > 1 el match es "lo que el usuario VE": la UI redondea los
// centavos al peso (pesos() hace Math.round), así que "2778731" debe
// matchear todo valor que REDONDEA a ese peso — [t·100−50, t·100+50).
// Un eq exacto casi nunca matchearía por las fracciones de centavo.
export const buscaNumero =
  (columna: string, factor = 1): CondicionBusqueda =>
  (termino) => {
    const numero = Number(termino);
    if (!Number.isFinite(numero) || termino === "") return null;
    const base = Math.round(numero * factor);
    if (factor <= 1) return `${columna}.eq.${base}`;
    const mitad = factor / 2;
    return `and(${columna}.gte.${base - mitad},${columna}.lt.${base + mitad})`;
  };

// "2026" → año completo, "2026-07" → mes completo, "2026-07-15" → ese día.
// Rango con and() anidado dentro del or() (sintaxis PostgREST). Sirve igual
// para date plana y timestamptz: el rango cubre el período entero.
export const buscaFecha =
  (columna: string): CondicionBusqueda =>
  (termino) => {
    if (/^\d{4}$/.test(termino)) {
      return `and(${columna}.gte.${termino}-01-01,${columna}.lt.${
        Number(termino) + 1
      }-01-01)`;
    }
    if (/^\d{4}-\d{2}$/.test(termino)) {
      const inicioMes = `${termino}-01`;
      return `and(${columna}.gte.${inicioMes},${columna}.lt.${agregarMeses(inicioMes, 1)})`;
    }
    if (FECHA_ISO.test(termino)) {
      return `and(${columna}.gte.${termino},${columna}.lt.${diaSiguiente(termino)})`;
    }
    return null;
  };

// Fragmentos que SÍ aplican al término (ya saneado). Lista vacía = ninguna
// columna puede matchear: el llamador responde resultado vacío.
export function condicionesDeBusqueda(
  estrategias: readonly CondicionBusqueda[],
  termino: string,
): string[] {
  return estrategias
    .map((estrategia) => estrategia(termino))
    .filter((condicion): condicion is string => condicion !== null);
}
