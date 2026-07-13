// Fachada del módulo (patrón Medusa v2) — token modulo.originacion.service.

import type {
  ComandoEvaluarSolicitud,
  EvaluarSolicitud,
} from "./application/evaluate-application";
import type {
  RepositorioProductos,
  RepositorioSolicitudes,
} from "./domain/repositories";

export class OriginacionService {
  constructor(
    private readonly casoEvaluar: EvaluarSolicitud,
    private readonly productos: RepositorioProductos,
    private readonly solicitudes: RepositorioSolicitudes,
  ) {}

  evaluarSolicitud(comando: ComandoEvaluarSolicitud) {
    return this.casoEvaluar.ejecutar(comando);
  }

  listarProductosActivos() {
    return this.productos.listarActivos();
  }

  async solicitudEvaluada(solicitudId: string) {
    const [solicitud, decision] = await Promise.all([
      this.solicitudes.buscarPorId(solicitudId),
      this.solicitudes.buscarDecision(solicitudId),
    ]);
    return solicitud && decision ? { solicitud, decision } : null;
  }
}
