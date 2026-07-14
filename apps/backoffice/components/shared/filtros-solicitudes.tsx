"use client";

// Filtros por columna de la tabla de solicitudes — solo narran la URL; el
// server component consulta el core con esos valores. Las opciones REALES
// (motos del catálogo, vendedores de la tienda) llegan por props desde el
// server component: este cliente no consulta nada.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

const DECISIONES = [
  { valor: "", etiqueta: "Decisión: todas" },
  { valor: "APROBADO", etiqueta: "Aprobadas" },
  { valor: "REVISION_MANUAL", etiqueta: "En revisión" },
  { valor: "NEGADO", etiqueta: "Negadas" },
];

const ESTADOS = [
  { valor: "", etiqueta: "Estado: todos" },
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "evaluada", etiqueta: "Evaluada" },
  { valor: "desembolsada", etiqueta: "Desembolsada" },
];

const ESTILO_SELECT =
  "rounded-lg border border-input bg-secondary px-2 py-1.5 text-sm text-foreground";

export function FiltrosSolicitudes({
  motos = [],
  vendedores = [],
}: {
  /** Nombres de moto del catálogo (opciones del filtro por columna Moto). */
  motos?: string[];
  /** Vendedores de la tienda (filtro por columna Vendedor, solo manager). */
  vendedores?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function narrar(param: string, valor: string) {
    const qs = new URLSearchParams(searchParams.toString());
    if (valor) qs.set(param, valor);
    else qs.delete(param);
    qs.delete("pagina");
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }

  function limpiar() {
    const qs = new URLSearchParams(searchParams.toString());
    for (const p of ["decision", "estado", "moto", "vendedor", "desde", "hasta", "solQuery", "pagina"]) {
      qs.delete(p);
    }
    router.replace(`${qs.size ? `${pathname}?${qs}` : pathname}`, { scroll: false });
  }

  const hayFiltros = ["decision", "estado", "moto", "vendedor", "desde", "hasta", "solQuery"].some(
    (p) => searchParams.has(p),
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={searchParams.get("decision") ?? ""}
        onChange={(e) => narrar("decision", e.target.value)}
        className={ESTILO_SELECT}
      >
        {DECISIONES.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("estado") ?? ""}
        onChange={(e) => narrar("estado", e.target.value)}
        className={ESTILO_SELECT}
      >
        {ESTADOS.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>

      {motos.length > 0 && (
        <select
          value={searchParams.get("moto") ?? ""}
          onChange={(e) => narrar("moto", e.target.value)}
          className={ESTILO_SELECT}
        >
          <option value="">Moto: todas</option>
          {motos.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}

      {vendedores.length > 0 && (
        <select
          value={searchParams.get("vendedor") ?? ""}
          onChange={(e) => narrar("vendedor", e.target.value)}
          className={ESTILO_SELECT}
        >
          <option value="">Vendedor: todos</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
      )}

      <input
        type="date"
        value={searchParams.get("desde") ?? ""}
        onChange={(e) => narrar("desde", e.target.value)}
        title="Desde"
        className={ESTILO_SELECT}
      />
      <input
        type="date"
        value={searchParams.get("hasta") ?? ""}
        onChange={(e) => narrar("hasta", e.target.value)}
        title="Hasta"
        className={ESTILO_SELECT}
      />

      {hayFiltros && (
        <button
          type="button"
          onClick={limpiar}
          className="flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:border-black hover:text-foreground"
        >
          <X className="size-3.5" />
          Limpiar
        </button>
      )}
    </div>
  );
}
