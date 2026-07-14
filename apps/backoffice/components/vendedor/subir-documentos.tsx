"use client";

// Paso cosmético (2026-07-13, aprobado por Julián): muestra el flujo de carga
// de documentos para la demo, pero NO sube ni guarda nada — solo lista los
// nombres de los archivos seleccionados en memoria del navegador. Backlog:
// definir dónde/cómo se almacenan documentos de verdad antes de producción.

import { useState } from "react";
import { FileCheck, Upload, X } from "lucide-react";

export function SubirDocumentos() {
  const [archivos, setArchivos] = useState<string[]>([]);

  function agregar(e: React.ChangeEvent<HTMLInputElement>) {
    const nombres = Array.from(e.target.files ?? []).map((f) => f.name);
    setArchivos((prev) => [...prev, ...nombres]);
    e.target.value = "";
  }

  function quitar(nombre: string) {
    setArchivos((prev) => prev.filter((n) => n !== nombre));
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground transition-colors duration-200 hover:border-primary">
        <Upload className="size-6" />
        Selecciona los documentos (cédula, comprobante de ingresos…)
        <input type="file" multiple className="sr-only" onChange={agregar} />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        Demostración: los archivos no se suben ni se guardan todavía — solo se muestran aquí.
      </p>
      {archivos.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {archivos.map((nombre) => (
            <li
              key={nombre}
              className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileCheck className="size-4 shrink-0 text-emerald-400" />
                <span className="truncate">{nombre}</span>
              </span>
              <button type="button" onClick={() => quitar(nombre)} aria-label={`Quitar ${nombre}`}>
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
