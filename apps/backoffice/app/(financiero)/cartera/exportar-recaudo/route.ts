// Descarga CSV del recaudo mensual con los mismos searchParams de la tabla
// del financiero. Ruta delgada: guarda de rol → fachada → serializar.

import type { NextRequest } from "next/server";
import type { FiltrosRecaudoMensual } from "@sumo/contracts";
import { exigirRol } from "@/lib/auth";
import { reporteriaService } from "@/lib/core-server";
import { aCsv, pesosCsv, respuestaCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) return sesion;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const recaudo = await reporteriaService().recaudoMensual({
    query: params.recQuery,
    filtros: params as FiltrosRecaudoMensual,
    orden: params.orden,
    direccion: params.dir === "asc" ? "asc" : "desc",
    limite: 1_000, // toda la historia mensual, no solo los 6 de la tabla
  });

  const csv = aCsv(
    [
      { titulo: "Mes", valor: (r) => r.mes.slice(0, 7) },
      { titulo: "Pagos", valor: (r) => r.pagos },
      { titulo: "Capital (COP)", valor: (r) => pesosCsv(r.capital_centavos) },
      { titulo: "Interés (COP)", valor: (r) => pesosCsv(r.interes_centavos) },
      { titulo: "Mora (COP)", valor: (r) => pesosCsv(r.mora_centavos) },
      { titulo: "Total (COP)", valor: (r) => pesosCsv(r.recaudo_centavos) },
    ],
    recaudo,
  );

  const hoy = new Date().toISOString().slice(0, 10);
  return respuestaCsv(`recaudo-mensual-${hoy}.csv`, csv);
}
