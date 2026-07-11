// Caso de uso estrella: evaluar una solicitud de crédito en minutos.
// Orquesta: producto → solicitud coherente → riesgo → motor → persistir → evento.

import type { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import type { Decision } from "../domain/decision";
import { decidirSolicitud } from "../domain/decision-engine";
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
  tiendaId: string;
  valorMotoCentavos: number;
  cuotaInicialCentavos: number;
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
      const guardada = await this.persistir(creacion.valor, decision, null);
      return exito(guardada);
    }

    const decision = decidirSolicitud(creacion.valor, producto, consulta.valor);
    const guardada = await this.persistir(creacion.valor, decision, consulta.valor);
    return exito(guardada);
  }

  private async persistir(
    solicitud: Solicitud,
    decision: Decision,
    reporteRiesgo: unknown,
  ): Promise<SolicitudEvaluada> {
    const guardada = await this.solicitudes.guardar({
      ...solicitud,
      estado: "evaluada",
    });
    await this.solicitudes.guardarDecision(guardada.id!, decision, reporteRiesgo);

    await this.bus.emit("originacion.solicitud.evaluada", {
      solicitudId: guardada.id,
      clienteId: guardada.clienteId,
      tiendaId: guardada.tiendaId,
      resultado: decision.resultado,
      cuotaEstimadaCentavos: decision.cuotaEstimadaCentavos,
    });

    return { solicitud: guardada, decision };
  }
}
