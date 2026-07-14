// Cita de agenda (reunión o visita de cliente) — TS puro, cero imports
// externos (regla 4). La validación de negocio vive aquí, no en la app.

import { exito, fallo, type Resultado } from "../../../kernel/result";

export type TipoCita = "reunion" | "visita";

export interface Cita {
  id?: string;
  tiendaId: string;
  creadoPor: string;
  titulo: string;
  tipo: TipoCita;
  // referencia SUAVE al módulo clientes (sin FK cruzada, regla 3)
  clienteCedula?: string;
  fechaHoraIso: string;
  notas?: string;
}

export interface DatosCita {
  tiendaId: string;
  creadoPor: string;
  titulo: string;
  tipo: TipoCita;
  clienteCedula?: string;
  fechaHoraIso: string;
  notas?: string;
}

export function crearCita(datos: DatosCita): Resultado<Cita, string[]> {
  const violaciones: string[] = [];

  if (datos.titulo.trim() === "") {
    violaciones.push("el título de la cita es obligatorio");
  }
  if (datos.tipo !== "reunion" && datos.tipo !== "visita") {
    violaciones.push("el tipo debe ser reunión o visita");
  }
  if (Number.isNaN(Date.parse(datos.fechaHoraIso))) {
    violaciones.push("la fecha y hora de la cita no son válidas");
  }
  if (datos.tiendaId.trim() === "" || datos.creadoPor.trim() === "") {
    violaciones.push("tienda y usuario creador son obligatorios");
  }

  if (violaciones.length > 0) return fallo(violaciones);

  return exito({
    ...datos,
    titulo: datos.titulo.trim(),
    clienteCedula: datos.clienteCedula?.trim() || undefined,
    notas: datos.notas?.trim() || undefined,
  });
}
