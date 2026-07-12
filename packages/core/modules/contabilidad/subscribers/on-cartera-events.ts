// Oídos de contabilidad: cada hecho económico de cartera genera su asiento.
// Un payload que no cuadra (asiento descuadrado) se loguea y NO revienta el
// bus — pero queda rastro para revisar a mano.

import type { EventoDominio } from "../../../kernel/event-bus";
import {
  asientoDeDesembolso,
  asientoDePago,
} from "../domain/entry-templates";
import type { RegistrarAsiento } from "../application/record-entry";

interface PayloadDesembolso {
  creditoId: string;
  montoCentavos: number;
  fecha?: string; // fecha del hecho económico, no del procesamiento
}

interface PayloadPago {
  pagoId: string;
  montoCentavos: number;
  capital: number;
  interes: number;
  mora: number;
  sobranteCentavos: number;
  fecha?: string;
}

const hoyIso = () => new Date().toISOString().slice(0, 10);

export function alDesembolsarCredito(registrar: RegistrarAsiento) {
  return async (evento: unknown): Promise<void> => {
    const { payload } = evento as EventoDominio<PayloadDesembolso>;
    const asiento = asientoDeDesembolso({
      creditoId: payload.creditoId,
      montoCentavos: payload.montoCentavos,
      fecha: payload.fecha ?? hoyIso(),
    });
    if (!asiento.ok) {
      console.error(`[contabilidad] asiento de desembolso inválido:`, asiento.error);
      return;
    }
    await registrar.ejecutar(asiento.valor);
  };
}

export function alRegistrarPago(registrar: RegistrarAsiento) {
  return async (evento: unknown): Promise<void> => {
    const { payload } = evento as EventoDominio<PayloadPago>;
    const asiento = asientoDePago({
      pagoId: payload.pagoId,
      montoCentavos: payload.montoCentavos,
      capitalCentavos: payload.capital,
      interesCentavos: payload.interes,
      moraCentavos: payload.mora,
      sobranteCentavos: payload.sobranteCentavos,
      fecha: payload.fecha ?? hoyIso(),
    });
    if (!asiento.ok) {
      console.error(`[contabilidad] asiento de pago inválido:`, asiento.error);
      return;
    }
    await registrar.ejecutar(asiento.valor);
  };
}
