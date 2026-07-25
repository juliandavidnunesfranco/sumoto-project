// Contratos de persistencia del módulo (DIP).

import type { ProductoCredito } from "./credit-product";
import type { Decision } from "./decision";
import type { Solicitud } from "./loan-application";

export interface RepositorioProductos {
  buscarPorId(id: string): Promise<ProductoCredito | null>;
  listarActivos(): Promise<ProductoCredito[]>;
  guardar(producto: Omit<ProductoCredito, "id">): Promise<ProductoCredito>;
  actualizarReglas(producto: ProductoCredito): Promise<ProductoCredito>;
}

export interface RepositorioSolicitudes {
  guardar(solicitud: Solicitud): Promise<Solicitud>;
  guardarDecision(solicitudId: string, decision: Decision, reporteRiesgo: unknown): Promise<void>;
  actualizarEstado(solicitudId: string, estado: Solicitud["estado"]): Promise<void>;
  // compensaciones del workflow de evaluación
  eliminar(solicitudId: string): Promise<void>;
  eliminarDecisiones(solicitudId: string): Promise<void>;
  // lecturas (pantalla de resultado y revisión del manager)
  buscarPorId(solicitudId: string): Promise<Solicitud | null>;
  buscarDecision(solicitudId: string): Promise<Decision | null>;
  // reporte del buró tal como se archivó con la decisión (expediente de
  // crédito: la SFC exige conservar los soportes de la evaluación)
  reporteDeRiesgo(solicitudId: string): Promise<unknown | null>;
}

/** Marca de un ítem del checklist pre-desembolso sobre una solicitud. */
export interface MarcaVerificacion {
  itemCodigo: string;
  marcado: boolean;
  marcadoPor: string;
  marcadoEn: string; // ISO
}

export interface RepositorioVerificaciones {
  marcar(
    solicitudId: string,
    itemCodigo: string,
    marcado: boolean,
    marcadoPor: string,
  ): Promise<void>;
  marcasDe(solicitudId: string): Promise<MarcaVerificacion[]>;
}

/** Documento del expediente aportado por el solicitante. */
export interface DocumentoExpediente {
  nombre: string;
  tamanoBytes: number;
  creadoEn: string; // ISO
}

// Almacén de documentos del expediente (Supabase Storage en infra; el
// dominio solo conoce bytes y nombres — regla 4).
export interface AlmacenDocumentos {
  guardar(
    solicitudId: string,
    nombre: string,
    contenido: ArrayBuffer,
    mime: string,
  ): Promise<void>;
  listar(solicitudId: string): Promise<DocumentoExpediente[]>;
  descargar(
    solicitudId: string,
    nombre: string,
  ): Promise<{ contenido: ArrayBuffer; mime: string } | null>;
}
