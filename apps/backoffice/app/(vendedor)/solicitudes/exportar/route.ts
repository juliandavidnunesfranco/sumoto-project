// Descarga CSV de solicitudes con los MISMOS searchParams de la tabla
// (filtros por columna, búsqueda y orden). Ruta delgada (regla 1): guarda
// de rol → fachada del core → serializar. El alcance por rol se re-aplica
// AQUÍ (vendedor: lo suyo; manager: su tienda) — jamás se confía en que la
// URL venga de la pantalla. Los filtros pasan crudos: el mapa de
// estrategias del core es la whitelist.

import type { NextRequest } from "next/server";
import type { FiltrosSolicitudes } from "@sumo/contracts";
import { exigirRol } from "@/lib/auth";
import { reporteriaService } from "@/lib/core-server";
import { aCsv, pesosCsv, respuestaCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const sesion = await exigirRol(["vendedor", "manager"]);
  if (sesion instanceof Response) return sesion;
  if (!sesion.tiendaId) {
    return Response.json({ error: "sin tienda asignada" }, { status: 403 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const { items } = await reporteriaService().solicitudesPaginadas({
    ...(sesion.rol === "vendedor"
      ? { creadoPor: sesion.userId }
      : { tiendaId: sesion.tiendaId }),
    query: params.solQuery,
    filtros: params as FiltrosSolicitudes,
    orden: params.orden,
    direccion: params.dir === "asc" ? "asc" : "desc",
    pagina: 1,
    porPagina: 10_000, // exportar exporta TODO lo filtrado, no una página
  });

  const csv = aCsv(
    [
      { titulo: "Solicitud", valor: (s) => `#${s.solicitud_corta}` },
      { titulo: "Cliente", valor: (s) => s.cliente_nombre },
      { titulo: "Cédula", valor: (s) => s.cliente_cedula },
      { titulo: "Moto", valor: (s) => s.moto_nombre },
      { titulo: "Vendedor", valor: (s) => s.vendedor_nombre },
      { titulo: "Valor moto (COP)", valor: (s) => pesosCsv(s.valor_moto_centavos) },
      {
        titulo: "Cuota estimada (COP)",
        valor: (s) =>
          s.cuota_estimada_centavos === null
            ? ""
            : pesosCsv(s.cuota_estimada_centavos),
      },
      { titulo: "Decisión", valor: (s) => s.decision_resultado },
      { titulo: "Estado", valor: (s) => s.estado },
      { titulo: "Creada", valor: (s) => s.creado_en },
    ],
    items,
  );

  const hoy = new Date().toISOString().slice(0, 10);
  return respuestaCsv(`solicitudes-${hoy}.csv`, csv);
}
