// Para operaciones que tocan varios módulos: si un paso falla,
// se deshacen los anteriores en orden inverso (patrón saga).

export interface PasoWorkflow<Ctx> {
  nombre: string;
  invocar(ctx: Ctx): Promise<void>;
  compensar?(ctx: Ctx): Promise<void>; // el "borrador": cómo deshacer este paso
}

export interface ResultadoWorkflow {
  ok: boolean;
  pasoFallido?: string;
  error?: unknown;
}

export async function ejecutarWorkflow<Ctx>(
  nombre: string,
  pasos: PasoWorkflow<Ctx>[],
  ctx: Ctx,
): Promise<ResultadoWorkflow> {
  const ejecutados: PasoWorkflow<Ctx>[] = [];

  for (const paso of pasos) {
    try {
      await paso.invocar(ctx);
      ejecutados.push(paso);
    } catch (error) {
      console.error(
        `[workflow:${nombre}] falló "${paso.nombre}", compensando...`,
        error,
      );
      // Deshacer en reversa lo que sí se hizo
      for (const hecho of ejecutados.reverse()) {
        try {
          await hecho.compensar?.(ctx);
        } catch (errComp) {
          // Falla compensando = alerta grave: queda inconsistencia que revisar a mano
          console.error(
            `[workflow:${nombre}] ERROR COMPENSANDO "${hecho.nombre}":`,
            errComp,
          );
        }
      }
      return { ok: false, pasoFallido: paso.nombre, error };
    }
  }
  return { ok: true };
}
