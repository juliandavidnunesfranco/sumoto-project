// Ruta delgada: autoriza → llama la fachada del core → responde. Cero lógica.

import type { ProductoResponse } from "@sumo/contracts";
import { exigirRol } from "@/lib/auth";
import { originacionService } from "@/lib/core-server";

export async function GET() {
  const sesion = await exigirRol(["vendedor", "manager"]);
  if (sesion instanceof Response) return sesion;

  const productos = await originacionService().listarProductosActivos();
  const respuesta: ProductoResponse[] = productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    tasaEA: p.tasaEA,
    plazoMinMeses: p.plazoMinMeses,
    plazoMaxMeses: p.plazoMaxMeses,
  }));
  return Response.json(respuesta);
}
