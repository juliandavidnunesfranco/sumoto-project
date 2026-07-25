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
import {
  MarcarItemVerificacion,
  type ComandoMarcarVerificacion,
} from "./application/verify-disbursement";
import {
  CHECKLIST_DESEMBOLSO,
  evaluarVerificacion,
  type EstadoVerificacion,
  type ItemVerificacion,
} from "./domain/verificacion";
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
import type {
  AlmacenDocumentos,
  MarcaVerificacion,
  RepositorioProductos,
  RepositorioSolicitudes,
  RepositorioVerificaciones,
} from "./domain/repositories";
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
  // etapa de otorgamiento (SARC): el expediente debe estar completo para
  // desembolsar; las razones viajan para explicar el bloqueo
  verificacionCompleta: boolean;
  verificacionRazones: string[];
}

/** Ítem del checklist con su marca vigente (para pintar el expediente). */
export interface ItemVerificado extends ItemVerificacion {
  marcado: boolean;
  marcadoPor?: string;
  marcadoEn?: string;
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
  private readonly casoMarcarVerificacion: MarcarItemVerificacion;

  constructor(
    private readonly casoEvaluar: EvaluarSolicitud,
    private readonly productos: RepositorioProductos,
    private readonly solicitudes: RepositorioSolicitudes,
    private readonly consultorRiesgo: ConsultorRiesgo,
    private readonly motor: MotorDecision,
    private readonly verificaciones: RepositorioVerificaciones,
    private readonly documentos: AlmacenDocumentos,
  ) {
    this.casoCrearProducto = new CrearProductoCredito(productos);
    this.casoActualizarReglas = new ActualizarReglasDecision(productos);
    this.casoMarcarVerificacion = new MarcarItemVerificacion(solicitudes, verificaciones);
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
    const verificacion = await this.estadoVerificacion(solicitudId);

    return {
      solicitudId,
      clienteId: par.solicitud.clienteId,
      tiendaId: par.solicitud.tiendaId,
      plazoMeses: par.solicitud.plazoMeses,
      montoAFinanciarCentavos: montoAFinanciarCentavos(par.solicitud),
      tasaEA: producto.tasaEA,
      aprobada: par.decision.resultado === "APROBADO",
      estado: par.solicitud.estado,
      verificacionCompleta: verificacion.completa,
      verificacionRazones: verificacion.razones,
    };
  }

  // ---------------------------------------------------------------------
  // Expediente pre-desembolso (etapa de otorgamiento)
  // ---------------------------------------------------------------------

  marcarVerificacion(comando: ComandoMarcarVerificacion): Promise<Resultado<void, string>> {
    return this.casoMarcarVerificacion.ejecutar(comando);
  }

  /** Checklist completo con las marcas vigentes + estado evaluado. */
  async verificacionDe(solicitudId: string): Promise<{
    items: ItemVerificado[];
    estado: EstadoVerificacion;
  }> {
    const marcas = await this.verificaciones.marcasDe(solicitudId);
    const porCodigo = new Map<string, MarcaVerificacion>(
      marcas.map((m) => [m.itemCodigo, m]),
    );
    const items: ItemVerificado[] = CHECKLIST_DESEMBOLSO.map((item) => {
      const marca = porCodigo.get(item.codigo);
      return {
        ...item,
        marcado: marca?.marcado ?? false,
        marcadoPor: marca?.marcadoPor,
        marcadoEn: marca?.marcadoEn,
      };
    });
    return {
      items,
      estado: evaluarVerificacion(items.filter((i) => i.marcado).map((i) => i.codigo)),
    };
  }

  private async estadoVerificacion(solicitudId: string): Promise<EstadoVerificacion> {
    const marcas = await this.verificaciones.marcasDe(solicitudId);
    return evaluarVerificacion(
      marcas.filter((m) => m.marcado).map((m) => m.itemCodigo),
    );
  }

  /** Reporte del buró tal como se archivó con la decisión (soporte SFC). */
  reporteDeRiesgoArchivado(solicitudId: string): Promise<unknown | null> {
    return this.solicitudes.reporteDeRiesgo(solicitudId);
  }

  // Documentos aportados por el solicitante (bucket privado tras el core:
  // la app jamás toca Storage directo — regla de conexión 1).
  subirDocumento(
    solicitudId: string,
    nombre: string,
    contenido: ArrayBuffer,
    mime: string,
  ): Promise<void> {
    return this.documentos.guardar(solicitudId, nombre, contenido, mime);
  }

  listarDocumentos(solicitudId: string) {
    return this.documentos.listar(solicitudId);
  }

  descargarDocumento(solicitudId: string, nombre: string) {
    return this.documentos.descargar(solicitudId, nombre);
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
