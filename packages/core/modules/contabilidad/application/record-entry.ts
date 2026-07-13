// Registrar un asiento: workflow con compensación — un encabezado sin partidas
// (asiento huérfano) no puede quedar en la base. El despacho a World Office es
// el último paso y NUNCA revierte el asiento: si el externo falla, el asiento
// queda 'fallido' para reintento — la contabilidad interna no depende de él.

import { ejecutarWorkflow, type PasoWorkflow } from "../../../kernel/workflow";
import type { AsientoContable } from "../domain/journal-entry";
import type { SistemaContable } from "../domain/accounting-system";
import type { RepositorioAsientos } from "../domain/repositories";

export class RegistrarAsiento {
  constructor(
    private readonly asientos: RepositorioAsientos,
    private readonly sistemaContable: SistemaContable,
  ) {}

  async ejecutar(asiento: AsientoContable): Promise<AsientoContable> {
    interface Ctx {
      guardado?: AsientoContable;
    }

    const pasos: PasoWorkflow<Ctx>[] = [
      {
        nombre: "guardar-encabezado",
        invocar: async (ctx) => {
          ctx.guardado = await this.asientos.guardarEncabezado(asiento);
        },
        compensar: async (ctx) => {
          if (ctx.guardado?.id) await this.asientos.eliminar(ctx.guardado.id);
        },
      },
      {
        nombre: "guardar-partidas",
        invocar: async (ctx) => {
          await this.asientos.guardarPartidas(ctx.guardado!);
        },
        // sin compensar propio: si falla él, no insertó nada (batch único);
        // si falla un paso posterior, eliminar el encabezado borra en cascada
      },
      {
        nombre: "despachar-a-sistema-contable",
        invocar: async (ctx) => {
          // best effort: ninguna falla del externo revierte el asiento
          try {
            const despacho = await this.sistemaContable.despachar(ctx.guardado!);
            if (despacho.ok) {
              await this.asientos.marcarDespacho(
                ctx.guardado!.id!,
                "despachado",
                despacho.valor.idExterno,
              );
            } else {
              console.error(
                `[contabilidad] despacho fallido del asiento ${ctx.guardado!.id}: ${despacho.error}`,
              );
              await this.asientos.marcarDespacho(ctx.guardado!.id!, "fallido");
            }
          } catch (error) {
            console.error(
              `[contabilidad] error despachando asiento ${ctx.guardado!.id}:`,
              error,
            );
          }
        },
      },
    ];

    const ctx: Ctx = {};
    const resultado = await ejecutarWorkflow("registrarAsiento", pasos, ctx);
    if (!resultado.ok) {
      throw new Error(
        `[contabilidad] asiento revertido: falló "${resultado.pasoFallido}" (${String(resultado.error)})`,
      );
    }
    return ctx.guardado!;
  }
}
