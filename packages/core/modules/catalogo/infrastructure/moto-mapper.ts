// Traducción fila SQL (snake_case, español) ↔ entidad del dominio.

import type { Moto } from "../domain/moto";

export interface FilaMoto {
  id: string;
  nombre: string;
  categoria: string;
  imagen: string;
  precio_contado_centavos: number;
  precio_credito_centavos: number;
  cilindraje: string;
  potencia: string;
  frenos: string;
  rendimiento: string;
  activo: boolean;
}

export function aMoto(fila: FilaMoto): Moto {
  return {
    id: fila.id,
    nombre: fila.nombre,
    categoria: fila.categoria,
    imagen: fila.imagen,
    precioContadoCentavos: fila.precio_contado_centavos,
    precioCreditoCentavos: fila.precio_credito_centavos,
    cilindraje: fila.cilindraje,
    potencia: fila.potencia,
    frenos: fila.frenos,
    rendimiento: fila.rendimiento,
    activo: fila.activo,
  };
}
