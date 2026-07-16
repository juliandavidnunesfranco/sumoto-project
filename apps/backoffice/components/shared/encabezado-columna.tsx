"use client";

// Encabezado de columna con orden y filtro integrados (patrón hoja de
// cálculo): CADA columna trae su menú, así todas las tablas comparten el
// mismo formato sin una fila de filtros aparte. Solo narra searchParams —
// el fetch siempre ocurre en el server component contra la fachada del core.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ListFilter, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface FiltroColumna {
  /** Nombre del searchParam que narra este filtro. */
  param: string;
  tipo: "opciones" | "rango-fechas" | "texto" | "numero";
  /** Solo para tipo "opciones". */
  opciones?: { valor: string; etiqueta: string }[];
  /** Para "rango-fechas": params desde/hasta (param se ignora). */
  paramDesde?: string;
  paramHasta?: string;
  /** Para "texto"/"numero": pista dentro del input. */
  placeholder?: string;
  /** Para "numero": multiplicador antes de narrar la URL — 100 convierte
   *  los pesos que escribe el usuario en los centavos de la vista. */
  factor?: number;
}

export function EncabezadoColumna({
  titulo,
  claveOrden,
  filtro,
  alinear = "izquierda",
  paramOrden = "orden",
  paramDir = "dir",
}: {
  titulo: string;
  /** Columna de la vista por la que ordena (whitelist en reporteria). */
  claveOrden?: string;
  filtro?: FiltroColumna;
  alinear?: "izquierda" | "derecha";
  /** Params de orden en la URL: configurables para que dos tablas de la
   *  misma página no se pisen (ej. "penOrden"/"penDir" en cartera). */
  paramOrden?: string;
  paramDir?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // cerrar con clic afuera o Escape
  useEffect(() => {
    if (!abierto) return;
    function alClicAfuera(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", alClicAfuera);
    document.addEventListener("keydown", alEscape);
    return () => {
      document.removeEventListener("mousedown", alClicAfuera);
      document.removeEventListener("keydown", alEscape);
    };
  }, [abierto]);

  const interactivo = Boolean(claveOrden || filtro);

  const ordenActual = searchParams.get(paramOrden);
  const dirActual = searchParams.get(paramDir) === "asc" ? "asc" : "desc";
  const ordenadaPorMi = claveOrden !== undefined && ordenActual === claveOrden;

  const paramsFiltro =
    filtro?.tipo === "rango-fechas"
      ? [filtro.paramDesde ?? "desde", filtro.paramHasta ?? "hasta"]
      : filtro
        ? [filtro.param]
        : [];
  const filtroActivo = paramsFiltro.some((p) => searchParams.get(p));

  function narrar(cambios: Record<string, string | null>) {
    const qs = new URLSearchParams(searchParams.toString());
    for (const [param, valor] of Object.entries(cambios)) {
      if (valor) qs.set(param, valor);
      else qs.delete(param);
    }
    qs.delete("pagina"); // todo cambio de criterio vuelve a la página 1
    router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function ordenar(dir: "asc" | "desc") {
    if (ordenadaPorMi && dirActual === dir) {
      // segundo clic: quitar el orden
      narrar({ [paramOrden]: null, [paramDir]: null });
    } else {
      narrar({ [paramOrden]: claveOrden!, [paramDir]: dir });
    }
  }

  if (!interactivo) {
    return (
      <span
        className={cn(
          "font-medium",
          alinear === "derecha" && "flex justify-end text-right",
        )}
      >
        {titulo}
      </span>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn("relative", alinear === "derecha" && "flex justify-end")}
    >
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className={cn(
          // patrón de hover del proyecto: borde inferior negro siempre
          // visible que se completa a marco entero en hover (transiciona
          // el COLOR, nunca el ancho — el layout no salta)
          "group inline-flex items-center gap-1 border border-transparent border-b-black px-1.5 py-0.5 font-medium transition-colors hover:border-black hover:text-foreground",
          (ordenadaPorMi || filtroActivo) && "text-foreground",
        )}
      >
        {titulo}
        {ordenadaPorMi &&
          (dirActual === "asc" ? (
            <ArrowUp className="size-3.5 text-primary" />
          ) : (
            <ArrowDown className="size-3.5 text-primary" />
          ))}
        {filtroActivo && <ListFilter className="size-3.5 text-primary" />}
        {!ordenadaPorMi && !filtroActivo && (
          <ChevronDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
        )}
      </button>

      {abierto && (
        <div
          className={cn(
            "absolute top-full z-40 mt-1 w-52 rounded-lg border border-border bg-background p-2 text-left shadow-lg",
            alinear === "derecha" ? "right-0" : "left-0",
          )}
        >
          {claveOrden && (
            <div className="mb-1 border-b border-border pb-1">
              <button
                type="button"
                onClick={() => ordenar("asc")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary",
                  ordenadaPorMi && dirActual === "asc" && "font-semibold text-primary",
                )}
              >
                <ArrowUp className="size-3.5" /> Ascendente
              </button>
              <button
                type="button"
                onClick={() => ordenar("desc")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary",
                  ordenadaPorMi && dirActual === "desc" && "font-semibold text-primary",
                )}
              >
                <ArrowDown className="size-3.5" /> Descendente
              </button>
            </div>
          )}

          {filtro?.tipo === "opciones" && (
            <div className="max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => narrar({ [filtro.param]: null })}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-xs hover:bg-secondary",
                  !searchParams.get(filtro.param) && "font-semibold",
                )}
              >
                Todas
              </button>
              {(filtro.opciones ?? []).map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() =>
                    narrar({
                      [filtro.param]:
                        searchParams.get(filtro.param) === o.valor ? null : o.valor,
                    })
                  }
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 text-xs hover:bg-secondary",
                    searchParams.get(filtro.param) === o.valor &&
                      "font-semibold text-primary",
                  )}
                >
                  {o.etiqueta}
                </button>
              ))}
            </div>
          )}

          {filtro?.tipo === "texto" && (
            <CampoFiltroTexto
              inicial={searchParams.get(filtro.param) ?? ""}
              placeholder={filtro.placeholder ?? "Contiene…"}
              onNarrar={(v) => narrar({ [filtro.param]: v || null })}
            />
          )}

          {filtro?.tipo === "numero" && (
            <CampoFiltroNumero
              inicial={searchParams.get(filtro.param) ?? ""}
              factor={filtro.factor ?? 1}
              placeholder={filtro.placeholder ?? "Valor…"}
              onNarrar={(v) => narrar({ [filtro.param]: v })}
            />
          )}

          {filtro?.tipo === "rango-fechas" && (
            <div className="space-y-1.5 px-1 py-1">
              <label className="block text-[10px] uppercase text-muted-foreground">
                Desde
                <input
                  type="date"
                  value={searchParams.get(filtro.paramDesde ?? "desde") ?? ""}
                  onChange={(e) =>
                    narrar({ [filtro.paramDesde ?? "desde"]: e.target.value || null })
                  }
                  className="mt-0.5 w-full rounded-md border border-input bg-secondary px-2 py-1 text-xs text-foreground"
                />
              </label>
              <label className="block text-[10px] uppercase text-muted-foreground">
                Hasta
                <input
                  type="date"
                  value={searchParams.get(filtro.paramHasta ?? "hasta") ?? ""}
                  onChange={(e) =>
                    narrar({ [filtro.paramHasta ?? "hasta"]: e.target.value || null })
                  }
                  className="mt-0.5 w-full rounded-md border border-input bg-secondary px-2 py-1 text-xs text-foreground"
                />
              </label>
            </div>
          )}

          {(filtroActivo || ordenadaPorMi) && (
            <button
              type="button"
              onClick={() => {
                const limpieza: Record<string, string | null> = {};
                for (const p of paramsFiltro) limpieza[p] = null;
                if (ordenadaPorMi) {
                  limpieza[paramOrden] = null;
                  limpieza[paramDir] = null;
                }
                narrar(limpieza);
                setAbierto(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-3.5" /> Limpiar columna
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Filtro de texto: narra con debounce mientras se escribe (misma cadencia
// que InputBusqueda) — solo estado local, el fetch sigue en el server.
function CampoFiltroTexto({
  inicial,
  placeholder,
  onNarrar,
}: {
  inicial: string;
  placeholder: string;
  onNarrar: (valor: string) => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function alEscribir(valor: string) {
    setTexto(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => onNarrar(valor.trim()), 400);
  }

  return (
    <div className="px-1 py-1">
      <input
        autoFocus
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-input bg-secondary px-2 py-1.5 text-xs text-foreground outline-none focus:border-black"
      />
    </div>
  );
}

// Filtro numérico: operador + valor → narra "op:valor". El factor traduce
// lo que escribe el usuario (pesos) a la unidad de la vista (centavos):
// la conversión muere en este borde, la URL ya viaja en centavos.
const OPERADORES_NUMERO = [
  { valor: "gte", etiqueta: "≥" },
  { valor: "gt", etiqueta: ">" },
  { valor: "eq", etiqueta: "=" },
  { valor: "lte", etiqueta: "≤" },
  { valor: "lt", etiqueta: "<" },
] as const;

function CampoFiltroNumero({
  inicial,
  factor,
  placeholder,
  onNarrar,
}: {
  /** Valor actual en la URL ("gte:120000000") o "". */
  inicial: string;
  factor: number;
  placeholder: string;
  onNarrar: (valor: string | null) => void;
}) {
  const [opInicial, crudoInicial] = inicial.includes(":")
    ? inicial.split(":", 2)
    : ["gte", inicial];
  const [op, setOp] = useState(
    OPERADORES_NUMERO.some((o) => o.valor === opInicial) ? opInicial : "gte",
  );
  const [numero, setNumero] = useState(
    crudoInicial && Number.isFinite(Number(crudoInicial))
      ? String(Number(crudoInicial) / factor)
      : "",
  );

  function aplicar() {
    const n = Number(numero);
    if (numero.trim() === "" || !Number.isFinite(n)) onNarrar(null);
    else onNarrar(`${op}:${Math.round(n * factor)}`);
  }

  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <select
        value={op}
        onChange={(e) => setOp(e.target.value)}
        aria-label="Operador"
        className="border border-input bg-secondary px-1 py-1.5 text-xs text-foreground outline-none focus:border-black"
      >
        {OPERADORES_NUMERO.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      <input
        autoFocus
        type="number"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && aplicar()}
        placeholder={placeholder}
        className="w-full min-w-0 border border-input bg-secondary px-2 py-1.5 text-xs text-foreground outline-none focus:border-black"
      />
      <button
        type="button"
        onClick={aplicar}
        className="shrink-0 border border-black px-2 py-1.5 text-xs font-medium transition-colors hover:bg-black hover:text-white"
      >
        OK
      </button>
    </div>
  );
}
