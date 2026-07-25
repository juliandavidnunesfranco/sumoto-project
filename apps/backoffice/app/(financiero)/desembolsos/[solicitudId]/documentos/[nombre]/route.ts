// Descarga de un documento del expediente (bucket privado tras el core).
// El nombre se re-valida con el MISMO schema de subida: nada de ../ ni rutas.

import type { NextRequest } from "next/server";
import { SubirDocumentoRequestSchema } from "@sumo/contracts";
import { exigirRol } from "@/lib/auth";
import { originacionService } from "@/lib/core-server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ solicitudId: string; nombre: string }> },
) {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) return sesion;

  const { solicitudId, nombre } = await ctx.params;
  const forma = SubirDocumentoRequestSchema.pick({ solicitudId: true, nombre: true }).safeParse({
    solicitudId,
    nombre: decodeURIComponent(nombre),
  });
  if (!forma.success) {
    return new Response("Nombre de documento inválido", { status: 400 });
  }

  const doc = await originacionService().descargarDocumento(
    forma.data.solicitudId,
    forma.data.nombre,
  );
  if (!doc) {
    return new Response("Documento no encontrado", { status: 404 });
  }

  return new Response(doc.contenido, {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${forma.data.nombre}"`,
    },
  });
}
