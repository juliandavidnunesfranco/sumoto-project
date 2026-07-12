// Workflow de desembolso (saga con compensación): crédito + plan de cuotas +
// enlace con la solicitud deben quedar completos o NO quedar — no hay
// transacción de base que cruce schemas, la consistencia la garantiza esto.

import type { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import { ejecutarWorkflow, type PasoWorkflow } from "../../../kernel/workflow";
import { cuotaMensualFrancesaCentavos } from "../../../shared/finance";
import type { Credito } from "../domain/credit";
import type { Cuota } from "../domain/installment";
import { generarPlanDePagos } from "../domain/payment-plan";
import type { RepositorioCreditos } from "../domain/repositories";

export interface ComandoDesembolsarCredito {
  solicitudId: string;
  clienteId: string;
  tiendaId: string;
  montoCentavos: number; // monto a financiar (valor moto - cuota inicial)
  tasaEA: number;
  tasaMoraEA: number;
  plazoMeses: number;
  fechaDesembolso: string; // ISO yyyy-mm-dd
}

export interface CreditoDesembolsado {
  credito: Credito;
  cuotas: Cuota[];
}

interface CtxDesembolso {
  comando: ComandoDesembolsarCredito;
  credito?: Credito;
  cuotas?: Cuota[];
}

export class DesembolsarCredito {
  constructor(
    private readonly creditos: RepositorioCreditos,
    private readonly bus: EventBus,
  ) {}

  async ejecutar(
    comando: ComandoDesembolsarCredito,
  ): Promise<Resultado<CreditoDesembolsado, string>> {
    const pasos: PasoWorkflow<CtxDesembolso>[] = [
      {
        nombre: "crear-credito",
        invocar: async (ctx) => {
          const cuota = cuotaMensualFrancesaCentavos(
            comando.montoCentavos,
            comando.tasaEA,
            comando.plazoMeses,
          );
          ctx.credito = await this.creditos.guardar({
            clienteId: comando.clienteId,
            tiendaId: comando.tiendaId,
            montoDesembolsadoCentavos: comando.montoCentavos,
            tasaEA: comando.tasaEA,
            tasaMoraEA: comando.tasaMoraEA,
            plazoMeses: comando.plazoMeses,
            cuotaCentavos: cuota,
            estado: "activo",
            desembolsadoEn: comando.fechaDesembolso,
          });
        },
        compensar: async (ctx) => {
          if (ctx.credito?.id) await this.creditos.eliminar(ctx.credito.id);
        },
      },
      {
        nombre: "generar-plan-de-cuotas",
        invocar: async (ctx) => {
          const plan = generarPlanDePagos({
            montoCentavos: comando.montoCentavos,
            tasaEA: comando.tasaEA,
            plazoMeses: comando.plazoMeses,
            fechaDesembolso: comando.fechaDesembolso,
          });
          ctx.cuotas = await this.creditos.guardarCuotas(ctx.credito!.id!, plan);
        },
        compensar: async (ctx) => {
          if (ctx.credito?.id) {
            await this.creditos.eliminarCuotasDeCredito(ctx.credito.id);
          }
        },
      },
      {
        nombre: "vincular-solicitud",
        invocar: async (ctx) => {
          await this.creditos.vincularSolicitud(
            comando.solicitudId,
            ctx.credito!.id!,
          );
        },
        compensar: async (ctx) => {
          await this.creditos.desvincularSolicitud(
            comando.solicitudId,
            ctx.credito!.id!,
          );
        },
      },
      {
        nombre: "anunciar-desembolso",
        invocar: async (ctx) => {
          // originación marca la solicitud como desembolsada al oír esto;
          // contabilidad generará el asiento (DB cartera / CR bancos)
          await this.bus.emit("cartera.credito.desembolsado", {
            creditoId: ctx.credito!.id,
            solicitudId: comando.solicitudId,
            clienteId: comando.clienteId,
            tiendaId: comando.tiendaId,
            montoCentavos: comando.montoCentavos,
            cuotaCentavos: ctx.credito!.cuotaCentavos,
            fecha: comando.fechaDesembolso,
          });
        },
      },
    ];

    const ctx: CtxDesembolso = { comando };
    const resultado = await ejecutarWorkflow("desembolsarCredito", pasos, ctx);

    if (!resultado.ok) {
      return fallo(
        `desembolso revertido: falló "${resultado.pasoFallido}" (${String(resultado.error)})`,
      );
    }
    return exito({ credito: ctx.credito!, cuotas: ctx.cuotas! });
  }
}
