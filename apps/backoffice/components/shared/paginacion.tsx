// Paginación reutilizable — Link + searchParams, cero JS. Siempre visible
// (aunque haya una sola página): los controles no aparecen/desaparecen
// según el filtro. La usan la galería de motos y "Mis solicitudes".

import Link from "next/link";
import { cn } from "@/lib/cn";

export function Paginacion({
  pagina,
  porPagina,
  total,
  hrefPagina,
  sustantivo,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  hrefPagina: (pagina: number) => string;
  /** [singular, plural]: ej. ["moto", "motos"]. */
  sustantivo: [string, string];
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const anteriorHabilitada = pagina > 1;
  const siguienteHabilitada = pagina < totalPaginas;

  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span>
        Página {pagina} de {totalPaginas} · {total}{" "}
        {total === 1 ? sustantivo[0] : sustantivo[1]}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={anteriorHabilitada ? hrefPagina(pagina - 1) : "#"}
          aria-disabled={!anteriorHabilitada}
          className={cn(
            "rounded-lg border border-input px-3 py-1.5 transition-colors duration-200",
            anteriorHabilitada ? "hover:border-primary hover:text-foreground" : "pointer-events-none opacity-40",
          )}
        >
          Anterior
        </Link>
        <Link
          href={siguienteHabilitada ? hrefPagina(pagina + 1) : "#"}
          aria-disabled={!siguienteHabilitada}
          className={cn(
            "rounded-lg border border-input px-3 py-1.5 transition-colors duration-200",
            siguienteHabilitada ? "hover:border-primary hover:text-foreground" : "pointer-events-none opacity-40",
          )}
        >
          Siguiente
        </Link>
      </div>
    </div>
  );
}
