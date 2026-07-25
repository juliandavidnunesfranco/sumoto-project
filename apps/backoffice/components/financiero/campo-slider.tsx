"use client";

// Slider de política estilo v0 (admin-politicas): range + valor grande en
// primary a la derecha; las reglas opcionales llevan el switch de v0 para
// activarlas/desactivarlas. Client mínimo: solo pinta el valor en vivo —
// el submit sigue siendo la server action del form que lo contiene (un
// input disabled no viaja en el FormData, así "regla apagada" llega al
// action como campo ausente → undefined, sin tocar Zod ni el dominio).

import { useState } from "react";
import { cn } from "@/lib/cn";

const PESOS = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function CampoSlider({
  label,
  descripcion,
  name,
  min,
  max,
  step,
  defaultValue,
  unidad,
  formato,
  opcional = false,
  activoInicial = true,
}: {
  label: string;
  descripcion?: string;
  name: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unidad?: string;
  /** "pesos" formatea COP; por defecto muestra el número tal cual. */
  formato?: "pesos";
  /** Regla opcional: switch estilo v0; apagada no se envía al servidor. */
  opcional?: boolean;
  activoInicial?: boolean;
}) {
  const [valor, setValor] = useState(defaultValue);
  const [activo, setActivo] = useState(opcional ? activoInicial : true);

  return (
    <div className={cn("transition-opacity", !activo && "opacity-60")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {descripcion ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {opcional ? (
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label={`Activar ${label}`}
            onClick={() => setActivo((a) => !a)}
            className={cn(
              "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
              activo ? "bg-primary" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform",
                activo ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <input
          type="range"
          name={name}
          min={min}
          max={max}
          step={step}
          value={valor}
          disabled={!activo}
          onChange={(e) => setValor(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-secondary accent-primary disabled:cursor-not-allowed"
        />
        <span className="w-28 shrink-0 text-right font-headline text-lg font-bold tabular-nums text-primary">
          {formato === "pesos" ? PESOS.format(valor) : valor}
          {unidad ? (
            <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
              {unidad}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
