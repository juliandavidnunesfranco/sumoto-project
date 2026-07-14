"use client";

// Selector de tamaño de página reutilizable — solo narra la URL; el server
// component consulta el core con ese valor. Parametrizado por nombre de
// searchParam para que motos y solicitudes no colisionen.

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TAMANOS_PAGINA = [10, 20, 40, 50];

export function SelectorPorPagina({
  param,
  resetParam,
}: {
  /** searchParam del tamaño (ej. "motoPorPagina", "porPagina"). */
  param: string;
  /** searchParam de la página actual, que se borra al cambiar el tamaño. */
  resetParam: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function cambiar(valor: string) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set(param, valor);
    qs.delete(resetParam);
    router.replace(`${pathname}?${qs}`, { scroll: false });
  }

  return (
    <select
      value={searchParams.get(param) ?? "10"}
      onChange={(e) => cambiar(e.target.value)}
      className="rounded-lg border border-input bg-secondary px-2 py-1.5 text-sm text-foreground"
    >
      {TAMANOS_PAGINA.map((n) => (
        <option key={n} value={n}>
          {n} / página
        </option>
      ))}
    </select>
  );
}
