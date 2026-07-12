// Ruta delgada: el flujo estrella — evaluar la solicitud en vivo.

import {
  EvaluarSolicitudRequestSchema,
  type DecisionResponse,
} from "@sumo/contracts";
import { exigirRol } from "@/lib/auth";
import { originacionService } from "@/lib/core-server";
import { conValidacion } from "@/lib/validation";

export async function POST(request: Request) {
  const sesion = await exigirRol(["vendedor", "manager"]);
  if (sesion instanceof Response) return sesion;
  if (!sesion.tiendaId) {
    return Response.json({ error: "el usuario no tiene tienda asignada" }, { status: 403 });
  }

  const validacion = await conValidacion(EvaluarSolicitudRequestSchema, request);
  if (!validacion.ok) return validacion.respuesta;

  const resultado = await originacionService().evaluarSolicitud({
    ...validacion.datos,
    tiendaId: sesion.tiendaId,
  });

  if (!resultado.ok) {
    return Response.json({ errores: resultado.error }, { status: 422 });
  }

  const { solicitud, decision } = resultado.valor;
  const respuesta: DecisionResponse = {
    solicitudId: solicitud.id!,
    resultado: decision.resultado,
    razones: decision.razones,
    score: decision.score,
    cuotaEstimadaCentavos: decision.cuotaEstimadaCentavos,
  };
  return Response.json(respuesta, { status: 201 });
}
