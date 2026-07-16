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
}: {
  columnas: ColumnaDatos<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  /** Qué mostrar sin filas (mensaje o CTA). */
  vacio?: ReactNode;
}) {
  if (filas.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {vacio ?? "Sin resultados con los filtros actuales."}
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
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
  );
}
