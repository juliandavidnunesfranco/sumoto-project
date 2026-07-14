// Entidad Moto: el vehículo que se financia. Vive en su propio módulo (no en
// originacion) porque es un concepto distinto — "qué se financia" vs
// "políticas de crédito". Contado y crédito son precios DISTINTOS a propósito.

export interface Moto {
  id: string;
  nombre: string;
  categoria: string;
  imagen: string;
  precioContadoCentavos: number;
  precioCreditoCentavos: number;
  cilindraje: string;
  potencia: string;
  frenos: string;
  rendimiento: string;
  activo: boolean;
}
