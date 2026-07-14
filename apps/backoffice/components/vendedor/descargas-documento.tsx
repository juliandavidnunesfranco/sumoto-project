"use client";

// Descargas de demostración (2026-07-13, aprobado por Julián): el pagaré es
// texto plano generado en el navegador, marcado explícitamente como BORRADOR
// SIN VALIDEZ LEGAL — no debe confundirse con un documento real. El CSV del
// plan de pagos sí refleja números reales (misma función que usará cartera).

import type { Cuota } from "@sumo/core";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pesos } from "@/lib/format";

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

export function DescargasDocumento({
  clienteNombre,
  cedula,
  motoNombre,
  montoCentavos,
  plazoMeses,
  cuotaCentavos,
  cuotas,
}: {
  clienteNombre: string;
  cedula: string;
  motoNombre: string;
  montoCentavos: number;
  plazoMeses: number;
  cuotaCentavos: number;
  cuotas: Cuota[];
}) {
  function generarPagare() {
    const texto = `
================================================================
  DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL
  Generado únicamente con fines de demostración comercial.
================================================================

PAGARÉ (BORRADOR)

Deudor: ${clienteNombre}
Cédula: ${cedula}
Bien financiado: ${motoNombre}
Monto financiado: ${pesos(montoCentavos)}
Plazo: ${plazoMeses} meses
Cuota mensual: ${pesos(cuotaCentavos)}

Yo, ${clienteNombre}, identificado con cédula ${cedula}, me comprometo a
pagar la suma de ${pesos(montoCentavos)} en ${plazoMeses} cuotas mensuales
de ${pesos(cuotaCentavos)} cada una.

================================================================
  ESTE DOCUMENTO NO ES UN TÍTULO VALOR REAL.
  Requiere firma, revisión legal y proceso formal de la entidad.
================================================================
`.trim();
    descargar(`borrador-pagare-${cedula}.txt`, texto, "text/plain;charset=utf-8");
  }

  function generarCSV() {
    const filas = [
      "cuota,vence,capital,interes,total",
      ...cuotas.map(
        (c) =>
          `${c.numero},${c.fechaVencimiento.slice(0, 10)},${c.capitalCentavos / 100},${c.interesCentavos / 100},${(c.capitalCentavos + c.interesCentavos) / 100}`,
      ),
    ].join("\n");
    descargar(`plan-de-pagos-${cedula}.csv`, filas, "text/csv;charset=utf-8");
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="outline" onClick={generarPagare}>
        <FileText className="size-4" />
        Descargar pagaré (borrador)
      </Button>
      <Button type="button" variant="outline" onClick={generarCSV}>
        <FileSpreadsheet className="size-4" />
        Descargar plan de pagos (CSV)
      </Button>
    </div>
  );
}
