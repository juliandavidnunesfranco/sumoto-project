// Tabla genérica compartida: renderiza CUALQUIER dato (solicitudes, clientes,
// créditos…) con el mismo formato — cada encabezado trae su orden y filtro
// (EncabezadoColumna, el único pedazo client). Server component: recibe las
// filas ya resueltas contra la fachada del core; las definiciones de columna
// (con su render) viven en el server, así que aquí pueden viajar funciones.

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  EncabezadoColumna,
  type FiltroColumna,
} from "@/components/shared/encabezado-columna";
import { InputBusqueda } from "@/components/shared/input-busqueda";

export interface ColumnaDatos<T> {
  titulo: string;
  render: (fila: T) => ReactNode;
  /** Columna de la vista por la que ordena (whitelist en el core). */
  claveOrden?: string;
  filtro?: FiltroColumna;
  alinear?: "izquierda" | "derecha";
  clasesCelda?: string;
}

export function TablaDatos<T>({
  columnas,
  filas,
  claveFila,
  vacio,
  titulo,
  busqueda,
  paramOrden,
  paramDir,
}: {
  columnas: ColumnaDatos<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  /** Qué mostrar sin filas (mensaje o CTA). */
  vacio?: ReactNode;
  /** Título del bloque (font-headline 3xl), con la búsqueda enfrente. */
  titulo?: ReactNode;
  /** Búsqueda enfrentada al título: solo narra searchParams (el fetch
   *  sigue en el server component, contra la fachada del core). */
  busqueda?: { param: string; placeholder: string };
  /** Params de orden en la URL — configurables para que dos tablas en la
   *  misma página no se pisen (crearTableQuery debe recibir los mismos). */
  paramOrden?: string;
  paramDir?: string;
}) {
  // El encabezado (título + búsqueda) vive FUERA del early-return de vacío:
  // si una búsqueda no encuentra filas, el input debe seguir ahí para
  // poder corregirla o borrarla.
  const encabezado =
    titulo || busqueda ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        {titulo && <h2 className="font-headline text-3xl">{titulo}</h2>}
        {busqueda && (
          <InputBusqueda
            param={busqueda.param}
            placeholder={busqueda.placeholder}
            limpiarParams={["pagina"]}
            // flexible: encoge para quedar a la altura del título (tope
            // 320px, piso 160px — por debajo, envuelve a la línea siguiente)
            className="min-w-40 max-w-80 flex-1"
          />
        )}
      </div>
    ) : null;

  if (filas.length === 0) {
    return (
      <div>
        {encabezado}
        <div className="py-10 text-center text-sm text-muted-foreground">
          {vacio ?? "Sin resultados con los filtros actuales."}
        </div>
      </div>
    );
  }

  return (
    <div>
      {encabezado}
      <table className={cn("w-full text-sm", encabezado && "mt-4")}>
      <thead className="text-left text-muted-foreground">
        <tr className="border-b border-border">
          {columnas.map((c) => (
            <th
              key={c.titulo}
              className={cn("pb-3 pr-4 font-medium last:pr-0", c.clasesCelda)}
            >
              <EncabezadoColumna
                titulo={c.titulo}
                claveOrden={c.claveOrden}
                filtro={c.filtro}
                alinear={c.alinear}
                paramOrden={paramOrden}
                paramDir={paramDir}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {filas.map((fila) => (
          <tr key={claveFila(fila)}>
            {columnas.map((c) => (
              <td
                key={c.titulo}
                className={cn(
                  "py-3 pr-4 last:pr-0",
                  c.alinear === "derecha" && "text-right",
                  c.clasesCelda,
                )}
              >
                {c.render(fila)}
              </td>
            ))}
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
