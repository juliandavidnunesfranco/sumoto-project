// Fachada del módulo (patrón Medusa v2) — token modulo.originacion.service.

import type { Resultado } from "../../kernel/result";
import type {
  ComandoEvaluarSolicitud,
  EvaluarSolicitud,
} from "./application/evaluate-application";
import {
  ActualizarReglasDecision,
  CrearProductoCredito,
} from "./application/manage-credit-product";
import type {
  DatosProducto,
  ProductoCredito,
  ReglasDecision,
} from "./domain/credit-product";
import type { Decision } from "./domain/decision";
import type { MotorDecision } from "./domain/decision-engine";
import {
  montoAFinanciarCentavos,
  type EstadoSolicitud,
} from "./domain/loan-application";
import type { RepositorioProductos, RepositorioSolicitudes } from "./domain/repositories";
import type { ConsultorRiesgo } from "./domain/risk-advisor";
import type { ReporteRiesgo } from "./domain/risk-report";

// DTO plano para el desembolso (lo consume cartera vía container, regla 3).
export interface SolicitudParaDesembolso {
  solicitudId: string;
  clienteId: string;
  tiendaId: string;
  plazoMeses: number;
  montoAFinanciarCentavos: number;
  tasaEA: number;
  aprobada: boolean;
  estado: EstadoSolicitud;
}

export interface ComandoSimularDecision {
  cedula: string;
  valorMotoCentavos: number;
  cuotaInicialCentavos: number;
  plazoMeses: number;
  ingresosDeclaradosCentavos: number;
  reglasDecision: ReglasDecision;
  tasaEA: number;
}

export class OriginacionService {
  private readonly casoCrearProducto: CrearProductoCredito;
  private readonly casoActualizarReglas: ActualizarReglasDecision;

  constructor(
    private readonly casoEvaluar: EvaluarSolicitud,
    private readonly productos: RepositorioProductos,
    private readonly solicitudes: RepositorioSolicitudes,
    private readonly consultorRiesgo: ConsultorRiesgo,
    private readonly motor: MotorDecision,
  ) {
    this.casoCrearProducto = new CrearProductoCredito(productos);
    this.casoActualizarReglas = new ActualizarReglasDecision(productos);
  }

  evaluarSolicitud(comando: ComandoEvaluarSolicitud) {
    return this.casoEvaluar.ejecutar(comando);
  }

  listarProductosActivos() {
    return this.productos.listarActivos();
  }

  buscarProducto(id: string) {
    return this.productos.buscarPorId(id);
  }

  crearProducto(datos: DatosProducto): Promise<Resultado<ProductoCredito, string[]>> {
    return this.casoCrearProducto.ejecutar(datos);
  }

  actualizarReglas(
    productoId: string,
    reglasNuevas: ReglasDecision,
  ): Promise<Resultado<ProductoCredito, string[]>> {
    return this.casoActualizarReglas.ejecutar(productoId, reglasNuevas);
  }

  // Consulta de riesgo aislada (sin evaluar solicitud todavía): para mostrar
  // el score justo después de escanear la cédula, antes de armar el crédito.
  consultarRiesgo(cedula: string): Promise<Resultado<ReporteRiesgo, string>> {
    return this.consultorRiesgo.consultar(cedula);
  }

  // Todo lo que cartera necesita para desembolsar, en un DTO plano: el monto
  // a financiar se calcula AQUÍ (regla de este dominio) y la tasa sale del
  // producto con el que se evaluó. Cartera lo consume vía container (regla 3).
  async paraDesembolso(solicitudId: string): Promise<SolicitudParaDesembolso | null> {
    const par = await this.solicitudEvaluada(solicitudId);
    if (!par) return null;
    const producto = await this.productos.buscarPorId(par.solicitud.productoId);
    if (!producto) return null;

    return {
      solicitudId,
      clienteId: par.solicitud.clienteId,
      tiendaId: par.solicitud.tiendaId,
      plazoMeses: par.solicitud.plazoMeses,
      montoAFinanciarCentavos: montoAFinanciarCentavos(par.solicitud),
      tasaEA: producto.tasaEA,
      aprobada: par.decision.resultado === "APROBADO",
      estado: par.solicitud.estado,
    };
  }

  async solicitudEvaluada(solicitudId: string) {
    const [solicitud, decision] = await Promise.all([
      this.solicitudes.buscarPorId(solicitudId),
      this.solicitudes.buscarDecision(solicitudId),
    ]);
    return solicitud && decision ? { solicitud, decision } : null;
  }

  // Preview de políticas: corre el motor REAL contra un caso de prueba, sin
  // persistir nada (ni solicitud ni decisión). Para el simulador de financiero.
  async simularDecision(
    comando: ComandoSimularDecision,
  ): Promise<Resultado<Decision, string>> {
    const consulta = await this.consultorRiesgo.consultar(comando.cedula);
    if (!consulta.ok) {
      return { ok: false, error: consulta.error };
    }

    const productoCandidato = {
      id: "candidato-sin-persistir",
      nombre: "(simulación)",
      tasaEA: comando.tasaEA,
      plazoMinMeses: 1,
      plazoMaxMeses: comando.plazoMeses,
      reglasDecision: comando.reglasDecision,
      activo: true,
    };

    const solicitudSimulada = {
      clienteId: "simulacion",
      productoId: productoCandidato.id,
      motoId: "simulacion",
      tiendaId: "simulacion",
      creadoPor: "simulacion",
      valorMotoCentavos: comando.valorMotoCentavos,
      cuotaInicialCentavos: comando.cuotaInicialCentavos,
      plazoMeses: comando.plazoMeses,
      ingresosDeclaradosCentavos: comando.ingresosDeclaradosCentavos,
      estado: "pendiente" as const,
    };

    const decision = this.motor.decidir(solicitudSimulada, productoCandidato, consulta.valor);
    return { ok: true, valor: decision };
  }
}
