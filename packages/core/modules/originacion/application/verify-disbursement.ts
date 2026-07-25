// Caso de uso: marcar/desmarcar un ítem del checklist pre-desembolso.
// Mutación de UN paso (upsert idempotente) — no requiere saga, igual que
// actualizar reglas. La evaluación del expediente es función pura del dominio.

import { exito, fallo, type Resultado } from "../../../kernel/result";
import { esCodigoDeChecklist } from "../domain/verificacion";
import type {
  RepositorioSolicitudes,
  RepositorioVerificaciones,
} from "../domain/repositories";

export interface ComandoMarcarVerificacion {
  solicitudId: string;
  itemCodigo: string;
  marcado: boolean;
  /** usuario que verifica — viene de la SESIÓN del servidor, jamás del form */
  marcadoPor: string;
}

export class MarcarItemVerificacion {
  constructor(
    private readonly solicitudes: RepositorioSolicitudes,
    private readonly verificaciones: RepositorioVerificaciones,
  ) {}

  async ejecutar(comando: ComandoMarcarVerificacion): Promise<Resultado<void, string>> {
    if (!esCodigoDeChecklist(comando.itemCodigo)) {
      return fallo(`el ítem "${comando.itemCodigo}" no existe en el checklist`);
    }
    const solicitud = await this.solicitudes.buscarPorId(comando.solicitudId);
    if (!solicitud) {
      return fallo("la solicitud no existe");
    }
    if (solicitud.estado === "desembolsada") {
      return fallo("la solicitud ya fue desembolsada — el expediente está cerrado");
    }

    await this.verificaciones.marcar(
      comando.solicitudId,
      comando.itemCodigo,
      comando.marcado,
      comando.marcadoPor,
    );
    return exito(undefined);
  }
}
