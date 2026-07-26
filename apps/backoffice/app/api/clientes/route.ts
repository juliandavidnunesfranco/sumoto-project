// Ruta delgada: valida FORMA (Zod de @sumo/contracts) → fachada del core.

import {
  RegistrarClienteRequestSchema,
  type ClienteResponse,
} from "@sumo/contracts";
import { exigirRol } from "@/lib/auth";
import { clientesService } from "@/lib/core-server";
import { conValidacion } from "@/lib/validation";

export async function POST(request: Request) {
  const sesion = await exigirRol(["vendedor", "manager"]);
  if (sesion instanceof Response) return sesion;
  if (!sesion.tiendaId) {
    return Response.json({ error: "el usuario no tiene tienda asignada" }, { status: 403 });
  }

  const validacion = await conValidacion(RegistrarClienteRequestSchema, request);
  if (!validacion.ok) return validacion.respuesta;
  const cuerpo = validacion.datos;

  const resultado = await clientesService().registrarCliente({
    fuente: cuerpo.fuente,
    entradaCruda:
      cuerpo.fuente === "escaner" ? { codigo: cuerpo.codigo } : cuerpo.datos,
    ingresosDeclaradosCentavos: cuerpo.ingresosDeclaradosCentavos,
    tiendaId: sesion.tiendaId,
    empresaId: sesion.empresaId,
  });

  if (!resultado.ok) {
    return Response.json({ errores: resultado.error }, { status: 422 });
  }

  const c = resultado.valor;
  const respuesta: ClienteResponse = {
    id: c.id!,
    cedula: c.cedula,
    nombres: c.nombres,
    apellidos: c.apellidos,
    ciudad: c.ciudad,
    fechaNacimiento: c.fechaNacimiento,
  };
  return Response.json(respuesta, { status: 201 });
}
