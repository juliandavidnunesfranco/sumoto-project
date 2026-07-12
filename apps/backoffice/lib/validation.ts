// Wrapper de validación de FORMA en la frontera HTTP (equivalente al
// validateAndTransformBody de Medusa v2). El negocio se valida en el dominio.

import type { z } from "zod";

export async function conValidacion<S extends z.ZodType>(
  schema: S,
  request: Request,
): Promise<{ ok: true; datos: z.infer<S> } | { ok: false; respuesta: Response }> {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return {
      ok: false,
      respuesta: Response.json({ error: "cuerpo JSON inválido" }, { status: 400 }),
    };
  }

  const resultado = schema.safeParse(cuerpo);
  if (!resultado.success) {
    return {
      ok: false,
      respuesta: Response.json(
        {
          error: "datos inválidos",
          detalles: resultado.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`,
          ),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, datos: resultado.data };
}
