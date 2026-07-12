// Plantillas de asientos por evento de negocio.
// Desembolso: la plata sale del banco y nace la cartera.
// Pago: entra plata al banco; muere cartera (capital) y se reconocen ingresos
// (interés y mora); el sobrante queda como anticipo (pasivo con el cliente).

import type { Resultado } from "../../../kernel/result";
import {
  CUENTAS,
  credito,
  crearAsiento,
  debito,
  type AsientoContable,
} from "./journal-entry";

export interface HechoDesembolso {
  creditoId: string;
  montoCentavos: number;
  fecha: string;
}

export function asientoDeDesembolso(
  hecho: HechoDesembolso,
): Resultado<AsientoContable, string[]> {
  return crearAsiento(
    {
      fecha: hecho.fecha,
      descripcion: `Desembolso crédito ${hecho.creditoId}`,
      eventoOrigen: "cartera.credito.desembolsado",
      referenciaId: hecho.creditoId,
    },
    [
      debito(CUENTAS.cartera, hecho.montoCentavos),
      credito(CUENTAS.bancos, hecho.montoCentavos),
    ],
  );
}

export interface HechoPago {
  pagoId: string;
  montoCentavos: number;
  capitalCentavos: number;
  interesCentavos: number;
  moraCentavos: number;
  sobranteCentavos: number;
  fecha: string;
}

export function asientoDePago(
  hecho: HechoPago,
): Resultado<AsientoContable, string[]> {
  return crearAsiento(
    {
      fecha: hecho.fecha,
      descripcion: `Pago recibido ${hecho.pagoId}`,
      eventoOrigen: "cartera.pago.registrado",
      referenciaId: hecho.pagoId,
    },
    [
      debito(CUENTAS.bancos, hecho.montoCentavos),
      credito(CUENTAS.cartera, hecho.capitalCentavos),
      credito(CUENTAS.ingresoIntereses, hecho.interesCentavos),
      credito(CUENTAS.ingresoMora, hecho.moraCentavos),
      credito(CUENTAS.anticipos, hecho.sobranteCentavos),
    ],
  );
}
