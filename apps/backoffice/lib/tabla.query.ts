// Arma el TableQuery (orden + dirección + filtros por columna) desde los
// searchParams, guiado por las MISMAS definiciones de columna que renderiza
// TablaDatos: si una columna no declara filtro, su param ni se lee. La clave
// de cada filtro es el nombre del param — el core la valida contra su mapa
// de estrategias (whitelist), aquí solo se recolecta.

import type { ColumnaDatos } from "@/components/shared/tabla-datos";

export interface TableQuery<Filtros extends object = Record<string, string>> {
  orden?: string;
  direccion?: "asc" | "desc";
  filtros: Partial<Filtros>;
}

export function crearTableQuery<
  T,
  Filtros extends object = Record<string, string>,
>(
  searchParams: Record<string, string | undefined>,
  columnas: readonly ColumnaDatos<T>[],
  opciones?: {
    /** Mismos params de orden que se pasen a TablaDatos (dos tablas en una
     *  página = params distintos para no pisarse). */
    paramOrden?: string;
    paramDir?: string;
  },
): TableQuery<Filtros> {
  const filtros: Partial<Filtros> = {};

  function recolectar(param: string | undefined) {
    if (!param) return;
    const valor = searchParams[param];
    if (valor !== undefined && valor !== "") {
      filtros[param as keyof Filtros] = valor as Filtros[keyof Filtros];
    }
  }

  for (const columna of columnas) {
    if (!columna.filtro) continue;
    if (columna.filtro.tipo === "rango-fechas") {
      recolectar(columna.filtro.paramDesde ?? "desde");
      recolectar(columna.filtro.paramHasta ?? "hasta");
    } else {
      recolectar(columna.filtro.param);
    }
  }

  const dir = searchParams[opciones?.paramDir ?? "dir"];
  return {
    orden: searchParams[opciones?.paramOrden ?? "orden"],
    direccion: dir === "asc" || dir === "desc" ? dir : undefined,
    filtros,
  };
}
