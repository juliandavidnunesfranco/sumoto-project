// Traducción fila SQL (snake_case) ↔ entidad del dominio.

import type { Cita, TipoCita } from "../domain/cita";

export interface FilaCita {
  id: string;
  tienda_id: string;
  creado_por: string;
  titulo: string;
  tipo: TipoCita;
  cliente_cedula: string | null;
  fecha_hora: string;
  notas: string | null;
}

export function aCita(fila: FilaCita): Cita {
  return {
    id: fila.id,
    tiendaId: fila.tienda_id,
    creadoPor: fila.creado_por,
    titulo: fila.titulo,
    tipo: fila.tipo,
    clienteCedula: fila.cliente_cedula ?? undefined,
    fechaHoraIso: fila.fecha_hora,
    notas: fila.notas ?? undefined,
  };
}

export function aFilaNueva(cita: Cita): Omit<FilaCita, "id"> {
  return {
    tienda_id: cita.tiendaId,
    creado_por: cita.creadoPor,
    titulo: cita.titulo,
    tipo: cita.tipo,
    cliente_cedula: cita.clienteCedula ?? null,
    fecha_hora: cita.fechaHoraIso,
    notas: cita.notas ?? null,
  };
}
