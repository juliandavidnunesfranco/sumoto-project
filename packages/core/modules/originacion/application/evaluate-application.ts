// Caso de uso estrella: evaluar una solicitud de crédito en minutos.
// Orquesta: producto → solicitud coherente → riesgo → motor → persistir → evento.
// La persistencia (solicitud + decisión) es un workflow con compensación:
// una solicitud sin decisión no puede quedar viva.

import type { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import { ejecutarWorkflow, type PasoWorkflow } from "../../../kernel/workflow";
import type { Decision } from "../domain/decision";
import type { MotorDecision } from "../domain/decision-engine";
import { crearSolicitud, type Solicitud } from "../domain/loan-application";
import type {
  RepositorioProductos,
  RepositorioSolicitudes,
} from "../domain/repositories";
import type { ConsultorRiesgo } from "../domain/risk-advisor";

export interface ComandoEvaluarSolicitud {
  clienteId: string;
  cedula: string; // para la consulta de riesgo (la aporta quien ya registró al cliente)
  productoId: string;
  motoId: string;
  tiendaId: string;
  creadoPor: string;
  valorMotoCentavos: number;
  cuotaInicialCentavos: number;
  cargosAdicionalesCentavos?: number;
  plazoMeses: number;
  ingresosDeclaradosCentavos: number;
}

export interface SolicitudEvaluada {
  solicitud: Solicitud;
  decision: Decision;
}

export class EvaluarSolicitud {
  constructor(
    private readonly productos: RepositorioProductos,
    private readonly solicitudes: RepositorioSolicitudes,
    private readonly consultorRiesgo: ConsultorRiesgo,
    private readonly motor: MotorDecision,
    private readonly bus: EventBus,
  ) {}

  async ejecutar(
    comando: ComandoEvaluarSolicitud,
  ): Promise<Resultado<SolicitudEvaluada, string[]>> {
    const producto = await this.productos.buscarPorId(comando.productoId);
    if (!producto) {
      return fallo([`producto de crédito no encontrado: ${comando.productoId}`]);
    }

    const creacion = crearSolicitud(comando, producto);
    if (!creacion.ok) {
      return creacion;
    }

    const consulta = await this.consultorRiesgo.consultar(comando.cedula);
    if (!consulta.ok) {
      // Sin reporte de buró no se niega ni aprueba en automático:
      // pasa a revisión manual con la causa visible
      const decision: Decision = {
        resultado: "REVISION_MANUAL",
        razones: [`no fue posible consultar el buró: ${consulta.error}`],
        score: 0,
        cuotaEstimadaCentavos: 0,
      };
      return this.persistir(creacion.valor, decision, null);
    }

    const decision = this.motor.decidir(creacion.valor, producto, consulta.valor);
    return this.persistir(creacion.valor, decision, consulta.valor);
  }

  // Workflow: solicitud y decisión quedan completas o NO quedan.
  private async persistir(
    solicitud: Solicitud,
    decision: Decision,
    reporteRiesgo: unknown,
  ): Promise<Resultado<SolicitudEvaluada, string[]>> {
    interface Ctx {
      guardada?: Solicitud;
    }

    const pasos: PasoWorkflow<Ctx>[] = [
      {
        nombre: "guardar-solicitud",
        invocar: async (ctx) => {
          ctx.guardada = await this.solicitudes.guardar({
            ...solicitud,
            estado: "evaluada",
          });
        },
        compensar: async (ctx) => {
          if (ctx.guardada?.id) await this.solicitudes.eliminar(ctx.guardada.id);
        },
      },
      {
        nombre: "guardar-decision",
        invocar: async (ctx) => {
          await this.solicitudes.guardarDecision(
            ctx.guardada!.id!,
            decision,
            reporteRiesgo,
          );
        },
        compensar: async (ctx) => {
          await this.solicitudes.eliminarDecisiones(ctx.guardada!.id!);
        },
      },
      {
        nombre: "anunciar-evaluacion",
        invocar: async (ctx) => {
          await this.bus.emit("originacion.solicitud.evaluada", {
            solicitudId: ctx.guardada!.id,
            clienteId: ctx.guardada!.clienteId,
            tiendaId: ctx.guardada!.tiendaId,
            resultado: decision.resultado,
            cuotaEstimadaCentavos: decision.cuotaEstimadaCentavos,
          });
        },
      },
    ];

    const ctx: Ctx = {};
    const resultado = await ejecutarWorkflow("evaluarSolicitud", pasos, ctx);
    if (!resultado.ok) {
      return fallo([
        `evaluación revertida: falló "${resultado.pasoFallido}" (${String(resultado.error)})`,
      ]);
    }
    return exito({ solicitud: ctx.guardada!, decision });
  }
}
