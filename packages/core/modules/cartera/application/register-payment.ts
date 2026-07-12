// Caso de uso: registrar un pago y repartirlo mora → interés → capital.
// Es un workflow con compensación: pago sin acumulados actualizados (o al revés)
// no puede quedar — se revierte todo y el dinero jamás queda a medio aplicar.

import type { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import { ejecutarWorkflow, type PasoWorkflow } from "../../../kernel/workflow";
import { estaSaldada, type Cuota } from "../domain/installment";
import type { Pago } from "../domain/payment";
import {
  repartirPago,
  type AplicacionPago,
  type ComponentePago,
} from "../domain/payment-allocation";
import type {
  RepositorioCreditos,
  RepositorioPagos,
} from "../domain/repositories";

export interface ComandoRegistrarPago {
  creditoId: string;
  montoCentavos: number;
  fechaPago: string; // ISO yyyy-mm-dd
}

export interface PagoRegistrado {
  pago: Pago;
  aplicaciones: AplicacionPago[];
  totalesPorComponente: Record<ComponentePago, number>;
}

export class RegistrarPago {
  constructor(
    private readonly creditos: RepositorioCreditos,
    private readonly pagos: RepositorioPagos,
    private readonly bus: EventBus,
  ) {}

  async ejecutar(
    comando: ComandoRegistrarPago,
  ): Promise<Resultado<PagoRegistrado, string[]>> {
    if (
      !Number.isInteger(comando.montoCentavos) ||
      comando.montoCentavos <= 0
    ) {
      return fallo(["el monto del pago debe ser un entero en centavos mayor a cero"]);
    }

    const credito = await this.creditos.buscarPorId(comando.creditoId);
    if (!credito) {
      return fallo([`crédito no encontrado: ${comando.creditoId}`]);
    }
    if (credito.estado !== "activo") {
      return fallo([`el crédito está ${credito.estado}: no recibe pagos`]);
    }

    const cuotas = await this.creditos.cuotasDeCredito(comando.creditoId);
    if (cuotas.every(estaSaldada)) {
      return fallo(["el crédito no tiene saldo pendiente"]);
    }

    const reparto = repartirPago({
      montoCentavos: comando.montoCentavos,
      cuotas,
      fechaPago: comando.fechaPago,
      tasaMoraEA: credito.tasaMoraEA,
    });
    const totales = totalesPorComponente(reparto.aplicaciones);

    interface Ctx {
      pago?: Pago;
      cuotasActualizadas: Cuota[]; // para restaurar acumulados si algo falla
    }

    const pasos: PasoWorkflow<Ctx>[] = [
      {
        nombre: "guardar-pago",
        invocar: async (ctx) => {
          ctx.pago = await this.pagos.guardar(
            {
              creditoId: comando.creditoId,
              montoCentavos: comando.montoCentavos,
              sobranteCentavos: reparto.sobranteCentavos,
              fechaPago: comando.fechaPago,
            },
            reparto.aplicaciones,
          );
        },
        compensar: async (ctx) => {
          if (ctx.pago?.id) await this.pagos.eliminar(ctx.pago.id);
        },
      },
      {
        nombre: "actualizar-cuotas",
        invocar: async (ctx) => {
          await this.aplicarACuotas(cuotas, reparto.aplicaciones, ctx);
        },
        compensar: async (ctx) => {
          // restaurar los acumulados ORIGINALES de las cuotas ya tocadas
          for (const original of ctx.cuotasActualizadas) {
            await this.pagos.actualizarAcumulados(original.id!, {
              capitalPagadoCentavos: original.capitalPagadoCentavos,
              interesPagadoCentavos: original.interesPagadoCentavos,
              moraPagadaCentavos: original.moraPagadaCentavos,
            });
          }
        },
      },
      {
        nombre: "anunciar-pago",
        invocar: async (ctx) => {
          await this.bus.emit("cartera.pago.registrado", {
            pagoId: ctx.pago!.id,
            creditoId: comando.creditoId,
            tiendaId: credito.tiendaId,
            montoCentavos: comando.montoCentavos,
            sobranteCentavos: reparto.sobranteCentavos,
            fecha: comando.fechaPago,
            ...totales,
          });
        },
      },
    ];

    const ctx: Ctx = { cuotasActualizadas: [] };
    const resultado = await ejecutarWorkflow("registrarPago", pasos, ctx);
    if (!resultado.ok) {
      return fallo([
        `pago revertido: falló "${resultado.pasoFallido}" (${String(resultado.error)})`,
      ]);
    }
    return exito({
      pago: ctx.pago!,
      aplicaciones: reparto.aplicaciones,
      totalesPorComponente: totales,
    });
  }

  // El kernel (como toda saga) solo compensa pasos COMPLETADOS: si este paso
  // muere a mitad, debe limpiar él mismo lo que alcanzó a tocar antes de
  // relanzar. Su compensar() del workflow cubre el otro caso: que falle un
  // paso posterior cuando este ya terminó.
  private async aplicarACuotas(
    cuotas: Cuota[],
    aplicaciones: AplicacionPago[],
    ctx: { cuotasActualizadas: Cuota[] },
  ): Promise<void> {
    const porCuota = new Map<number, AplicacionPago[]>();
    for (const a of aplicaciones) {
      porCuota.set(a.cuotaNumero, [...(porCuota.get(a.cuotaNumero) ?? []), a]);
    }
    try {
      for (const [numero, apls] of porCuota) {
        const cuota = cuotas.find((c) => c.numero === numero)!;
        const suma = (componente: ComponentePago) =>
          apls
            .filter((a) => a.componente === componente)
            .reduce((s, a) => s + a.montoCentavos, 0);
        await this.pagos.actualizarAcumulados(cuota.id!, {
          capitalPagadoCentavos: cuota.capitalPagadoCentavos + suma("capital"),
          interesPagadoCentavos: cuota.interesPagadoCentavos + suma("interes"),
          moraPagadaCentavos: cuota.moraPagadaCentavos + suma("mora"),
        });
        // registrar el estado ORIGINAL solo después de tocarla con éxito
        ctx.cuotasActualizadas.push(cuota);
      }
    } catch (error) {
      for (const original of ctx.cuotasActualizadas) {
        await this.pagos.actualizarAcumulados(original.id!, {
          capitalPagadoCentavos: original.capitalPagadoCentavos,
          interesPagadoCentavos: original.interesPagadoCentavos,
          moraPagadaCentavos: original.moraPagadaCentavos,
        });
      }
      ctx.cuotasActualizadas.length = 0;
      throw error;
    }
  }
}

function totalesPorComponente(
  aplicaciones: AplicacionPago[],
): Record<ComponentePago, number> {
  const totales: Record<ComponentePago, number> = { mora: 0, interes: 0, capital: 0 };
  for (const a of aplicaciones) {
    totales[a.componente] += a.montoCentavos;
  }
  return totales;
}
