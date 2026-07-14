// Galería de motos real: recibe la página ya resuelta contra el core
// (catalogoService().buscarMotos) — selección vía Link + searchParams, cero
// JS. El texto/tamaño de página SÍ necesitan un pequeño cliente (ver
// shared/input-busqueda y selector-por-pagina) porque narran la URL.

import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import type { Moto } from "@sumo/core";
import { pesos } from "@/lib/format";
import { cn } from "@/lib/cn";

export function GaleriaMotos({
  motoId,
  motos,
  hrefMoto,
}: {
  motoId?: string;
  motos: Moto[];
  /** Construido por la página: conserva búsqueda/paginación al seleccionar. */
  hrefMoto: (motoId: string) => string;
}) {
  if (motos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin motos para esa búsqueda.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {motos.map((moto) => {
        const seleccionada = moto.id === motoId;
        return (
          <Link
            key={moto.id}
            href={hrefMoto(moto.id)}
            className={cn(
              "overflow-hidden rounded-2xl border bg-card transition-colors duration-200",
              seleccionada ? "border-primary" : "border-border hover:border-primary/50",
            )}
          >
            <div className="relative aspect-4/3 overflow-hidden bg-secondary">
              <Image
                src={moto.imagen}
                alt={moto.nombre}
                width={400}
                height={300}
                // viene de Supabase Storage (bucket "motos"): en local es un
                // host de IP privada (127.0.0.1), que el optimizador de
                // Next bloquea por protección SSRF — se sirve tal cual.
                unoptimized
                className="h-full w-full object-cover"
              />
              {seleccionada ? (
                <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="size-4" />
                </span>
              ) : null}
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground">{moto.categoria}</p>
              <h3 className="font-headline text-lg font-bold">{moto.nombre}</h3>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-sm font-semibold text-primary">{pesos(moto.precioCreditoCentavos)}</p>
                <p className="text-xs text-muted-foreground">crédito</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-sm text-muted-foreground">{pesos(moto.precioContadoCentavos)}</p>
                <p className="text-xs text-muted-foreground">contado</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{moto.cilindraje}</span>
                <span>·</span>
                <span>{moto.potencia}</span>
                <span>·</span>
                <span>{moto.frenos}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
