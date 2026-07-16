"use client";

// Input de búsqueda reutilizable, SSR-first: NO consulta nada — solo narra la
// URL (searchParams) con debounce, y quien busca de verdad es el server
// component de la página contra la fachada del core. Un solo componente para
// el header (ruta /buscar) y la galería de motos (motoQuery).
//
// FIX del bug de debounce (2026-07-14): la versión anterior sincronizaba el
// estado desde la URL en CADA cambio de searchParams, pisando lo que el
// usuario seguía escribiendo (el texto "se borraba y reaparecía"). Ahora la
// sincronización externa solo aplica cuando el input NO tiene el foco.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 300;

export function InputBusqueda({
  param,
  placeholder,
  ruta,
  limpiarParams = [],
  className,
}: {
  /** Nombre del searchParam que narra este input (ej. "q", "motoQuery"). */
  param: string;
  placeholder: string;
  /** Ruta destino; si se omite, narra sobre la página actual. */
  ruta?: string;
  /** Params a borrar al cambiar la búsqueda (ej. la página de paginación). */
  limpiarParams?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [texto, setTexto] = useState(searchParams.get(param) ?? "");

  // Sincronización URL → input SOLO sin foco: cubre navegación externa
  // (ej. "Nueva solicitud" limpia la URL) sin pisar al usuario que escribe.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setTexto(searchParams.get(param) ?? "");
  }, [searchParams, param]);

  function alEscribir(valor: string) {
    setTexto(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      const destino = ruta ?? pathname;
      // sobre la misma página se conservan los demás params; hacia otra
      // ruta (ej. /buscar) se viaja solo con el término
      const qs =
        destino === pathname
          ? new URLSearchParams(searchParams.toString())
          : new URLSearchParams();
      const limpio = valor.trim();
      if (limpio) qs.set(param, limpio);
      else qs.delete(param);
      for (const p of limpiarParams) qs.delete(p);
      router.replace(`${destino}${qs.size ? `?${qs}` : ""}`, { scroll: false });
    }, DEBOUNCE_MS);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 border border-transparent font-headline text-xl bg-secondary p-4 hover:border-black hover:text-muted-foreground",
        className,
      )}
    >
      <Search className="size-5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none"
      />
    </div>
  );
}
