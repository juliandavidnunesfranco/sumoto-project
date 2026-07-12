// Fachada del módulo (patrón Medusa v2) — token modulo.originacion.service.

import type {
  ComandoEvaluarSolicitud,
  EvaluarSolicitud,
} from "./application/evaluate-application";
import type { RepositorioProductos } from "./domain/repositories";

export class OriginacionService {
  constructor(
    private readonly casoEvaluar: EvaluarSolicitud,
    private readonly productos: RepositorioProductos,
  ) {}

  evaluarSolicitud(comando: ComandoEvaluarSolicitud) {
    return this.casoEvaluar.ejecutar(comando);
  }

  listarProductosActivos() {
    return this.productos.listarActivos();
  }
}
