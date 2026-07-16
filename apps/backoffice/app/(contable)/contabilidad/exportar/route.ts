// Descarga CSV de asientos con los mismos searchParams de la tabla del
// contable. Ruta delgada: guarda de rol → fachada → serializar (regla 1).

import type { NextRequest } from "next/server";
import type { FiltrosAsientos } from "@sumo/contracts";
import { exigirRol } from "@/lib/auth";
import { reporteriaService } from "@/lib/core-server";
import { aCsv, pesosCsv, respuestaCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const sesion = await exigirRol(["contable"]);
  if (sesion instanceof Response) return sesion;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const asientos = await reporteriaService().asientosRecientes({
    query: params.asiQuery,
    filtros: params as FiltrosAsientos,
    orden: params.orden,
    direccion: params.dir === "asc" ? "asc" : "desc",
    limite: 10_000, // exportar exporta TODO lo filtrado
  });

  const csv = aCsv(
    [
      { titulo: "Fecha", valor: (a) => a.fecha },
      { titulo: "Descripción", valor: (a) => a.descripcion },
      { titulo: "Evento origen", valor: (a) => a.evento_origen },
      { titulo: "Débito (COP)", valor: (a) => pesosCsv(a.total_debito_centavos) },
      { titulo: "Crédito (COP)", valor: (a) => pesosCsv(a.total_credito_centavos) },
      { titulo: "Despacho", valor: (a) => a.despacho },
    ],
    asientos,
  );

  const hoy = new Date().toISOString().slice(0, 10);
  return respuestaCsv(`asientos-${hoy}.csv`, csv);
}
