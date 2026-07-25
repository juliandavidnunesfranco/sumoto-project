// Descarga de los datos del documento de identidad del solicitante tal como
// quedaron registrados (escáner de cédula / entrada manual). Documento
// marcado DEMO. Ruta delgada: guarda de rol → fachada → serializar.

import type { NextRequest } from "next/server";
import { exigirRol } from "@/lib/auth";
import { clientesService, originacionService } from "@/lib/core-server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ solicitudId: string }> },
) {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) return sesion;

  const { solicitudId } = await ctx.params;
  const par = await originacionService().solicitudEvaluada(solicitudId);
  const cliente = par ? await clientesService().buscarPorId(par.solicitud.clienteId) : null;
  if (!cliente) {
    return new Response("Cliente no encontrado", { status: 404 });
  }

  const texto = `================================================================
  DOCUMENTO DE DEMOSTRACIÓN — SIN VALIDEZ LEGAL
  Datos de identidad registrados en el expediente.
================================================================

DOCUMENTO DE IDENTIDAD — EXPEDIENTE #${solicitudId.slice(0, 8)}

Nombres:            ${cliente.nombres}
Apellidos:          ${cliente.apellidos}
Cédula:             ${cliente.cedula}
Fecha de nacimiento: ${cliente.fechaNacimiento ?? "—"}
Ciudad:             ${cliente.ciudad ?? "—"}
Dirección:          ${cliente.direccion ?? "—"}
Estrato:            ${cliente.estrato ?? "—"}
Teléfono:           ${cliente.telefono ?? "—"}
Correo:             ${cliente.email ?? "—"}
Fuente de identidad: ${cliente.fuenteIdentidad}
Geo-coincidencia:   ${cliente.geoCoincide === undefined ? "—" : cliente.geoCoincide ? "coincide" : "NO coincide"}
`;

  return new Response(texto, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="identidad-${cliente.cedula}.txt"`,
    },
  });
}
