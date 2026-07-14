// Solicitud de crédito: la petición del vendedor, coherente con el producto.

import { exito, fallo, type Resultado } from "../../../kernel/result";
import type { ProductoCredito } from "./credit-product";

export type EstadoSolicitud = "pendiente" | "evaluada" | "desembolsada";

export interface Solicitud {
  id?: string;
  clienteId: string;
  productoId: string;
  // moto elegida por el vendedor (módulo catalogo): referencia plana sin FK
  // cruzada (regla 3), igual que clienteId/productoId — se conoce desde que
  // se crea la solicitud, no nace como efecto de un workflow aparte.
  motoId: string;
  tiendaId: string;
  // usuario (vendedor/manager) que originó la solicitud — viene de la
  // SESIÓN del servidor, jamás del formulario
  creadoPor: string;
  valorMotoCentavos: number;
  cuotaInicialCentavos: number;
  // papelería, SOAT y similares: los elige el vendedor por solicitud, no son
  // atributo fijo de la moto — se suman al monto a financiar.
  cargosAdicionalesCentavos?: number;
  plazoMeses: number;
  ingresosDeclaradosCentavos: number;
  estado: EstadoSolicitud;
}

export interface DatosSolicitud {
  clienteId: string;
  motoId: string;
  tiendaId: string;
  creadoPor: string;
  valorMotoCentavos: number;
  cuotaInicialCentavos: number;
  cargosAdicionalesCentavos?: number;
  plazoMeses: number;
  ingresosDeclaradosCentavos: number;
}

// Coherencia estructural contra el producto. Las políticas de riesgo
// (score, capacidad, LTV) son del motor de decisión, no de aquí.
export function crearSolicitud(
  datos: DatosSolicitud,
  producto: ProductoCredito,
): Resultado<Solicitud, string[]> {
  const violaciones: string[] = [];

  if (!producto.activo) {
    violaciones.push(`el producto "${producto.nombre}" no está activo`);
  }
  if (
    !Number.isInteger(datos.valorMotoCentavos) ||
    datos.valorMotoCentavos <= 0
  ) {
    violaciones.push("el valor de la moto debe ser un entero en centavos mayor a cero");
  }
  if (
    !Number.isInteger(datos.cuotaInicialCentavos) ||
    datos.cuotaInicialCentavos < 0
  ) {
    violaciones.push("la cuota inicial debe ser un entero en centavos, cero o más");
  }
  if (datos.cuotaInicialCentavos >= datos.valorMotoCentavos) {
    violaciones.push("la cuota inicial debe ser menor al valor de la moto");
  }
  if (
    datos.cargosAdicionalesCentavos !== undefined &&
    (!Number.isInteger(datos.cargosAdicionalesCentavos) || datos.cargosAdicionalesCentavos < 0)
  ) {
    violaciones.push("los cargos adicionales deben ser un entero en centavos, cero o más");
  }
  if (
    datos.plazoMeses < producto.plazoMinMeses ||
    datos.plazoMeses > producto.plazoMaxMeses
  ) {
    violaciones.push(
      `el plazo debe estar entre ${producto.plazoMinMeses} y ${producto.plazoMaxMeses} meses`,
    );
  }
  if (
    !Number.isInteger(datos.ingresosDeclaradosCentavos) ||
    datos.ingresosDeclaradosCentavos <= 0
  ) {
    violaciones.push("los ingresos declarados deben ser un entero en centavos mayor a cero");
  }
  if (
    datos.clienteId.trim() === "" ||
    datos.tiendaId.trim() === "" ||
    datos.motoId.trim() === "" ||
    datos.creadoPor.trim() === ""
  ) {
    violaciones.push("cliente, tienda, moto y usuario creador son obligatorios");
  }

  if (violaciones.length > 0) return fallo(violaciones);

  return exito({
    ...datos,
    productoId: producto.id,
    estado: "pendiente",
  });
}

export function montoAFinanciarCentavos(solicitud: {
  valorMotoCentavos: number;
  cuotaInicialCentavos: number;
  cargosAdicionalesCentavos?: number;
}): number {
  return (
    solicitud.valorMotoCentavos -
    solicitud.cuotaInicialCentavos +
    (solicitud.cargosAdicionalesCentavos ?? 0)
  );
}
