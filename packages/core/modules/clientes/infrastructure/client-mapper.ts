// Traducción fila SQL (snake_case, español) ↔ entidad del dominio.

import type { Cliente } from "../domain/client";
import type { FuenteDeDatos } from "../domain/citizen-data";

export interface FilaCliente {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  ingresos_declarados_centavos: number | null;
  fuente_identidad: FuenteDeDatos;
  tienda_id: string;
}

export function aCliente(fila: FilaCliente): Cliente {
  return {
    id: fila.id,
    cedula: fila.cedula,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    fechaNacimiento: fila.fecha_nacimiento ?? undefined,
    telefono: fila.telefono ?? undefined,
    email: fila.email ?? undefined,
    direccion: fila.direccion ?? undefined,
    ciudad: fila.ciudad ?? undefined,
    ingresosDeclaradosCentavos: fila.ingresos_declarados_centavos ?? undefined,
    fuenteIdentidad: fila.fuente_identidad,
    tiendaId: fila.tienda_id,
  };
}

export function aFilaNueva(cliente: Cliente): Omit<FilaCliente, "id"> {
  return {
    cedula: cliente.cedula,
    nombres: cliente.nombres,
    apellidos: cliente.apellidos,
    fecha_nacimiento: cliente.fechaNacimiento ?? null,
    telefono: cliente.telefono ?? null,
    email: cliente.email ?? null,
    direccion: cliente.direccion ?? null,
    ciudad: cliente.ciudad ?? null,
    ingresos_declarados_centavos: cliente.ingresosDeclaradosCentavos ?? null,
    fuente_identidad: cliente.fuenteIdentidad,
    tienda_id: cliente.tiendaId,
  };
}
