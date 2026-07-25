// Descarga del reporte de buró TAL COMO SE ARCHIVÓ con la decisión (soporte
// del expediente — la SFC exige conservar los insumos de la evaluación).
// Ruta delgada: guarda de rol → fachada → serializar (regla 1). Documento
// marcado DEMO: hoy el buró es el mock de Experian.

import type { NextRequest } from "next/server";
import { exigirRol } from "@/lib/auth";
import { originacionService } from "@/lib/core-server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ solicitudId: string }> },
) {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) return sesion;

  const { solicitudId } = await ctx.params;
  const [reporte, par] = await Promise.all([
    originacionService().reporteDeRiesgoArchivado(solicitudId),
    originacionService().solicitudEvaluada(solicitudId),
  ]);
  if (!reporte || !par) {
    return new Response("Reporte no encontrado", { status: 404 });
  }

  const texto = `================================================================
  DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL
  Reporte de central de riesgo (mock) archivado con la decisión.
================================================================

REPORTE DE BURÓ — EXPEDIENTE #${solicitudId.slice(0, 8)}
Resultado del motor: ${par.decision.resultado} · score ${par.decision.score}

${JSON.stringify(reporte, null, 2)}
`;

  return new Response(texto, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-buro-${solicitudId.slice(0, 8)}.txt"`,
    },
  });
}
