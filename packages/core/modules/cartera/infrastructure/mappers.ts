// Traducción filas SQL (snake_case) ↔ dominio.

import type { Credito, EstadoCredito } from "../domain/credit";
import type { Cuota } from "../domain/installment";

export interface FilaCredito {
  id: string;
  cliente_id: string;
  tienda_id: string;
  monto_desembolsado_centavos: number;
  tasa_ea: string | number; // numeric llega como string por PostgREST
  tasa_mora_ea: string | number;
  plazo_meses: number;
  cuota_centavos: number;
  estado: EstadoCredito;
  desembolsado_en: string;
}

export function aCredito(fila: FilaCredito): Credito {
  return {
    id: fila.id,
    clienteId: fila.cliente_id,
    tiendaId: fila.tienda_id,
    montoDesembolsadoCentavos: Number(fila.monto_desembolsado_centavos),
    tasaEA: Number(fila.tasa_ea),
    tasaMoraEA: Number(fila.tasa_mora_ea),
    plazoMeses: fila.plazo_meses,
    cuotaCentavos: Number(fila.cuota_centavos),
    estado: fila.estado,
    desembolsadoEn: fila.desembolsado_en,
  };
}

export function aFilaCreditoNueva(c: Credito): Omit<FilaCredito, "id"> {
  return {
    cliente_id: c.clienteId,
    tienda_id: c.tiendaId,
    monto_desembolsado_centavos: c.montoDesembolsadoCentavos,
    tasa_ea: c.tasaEA,
    tasa_mora_ea: c.tasaMoraEA,
    plazo_meses: c.plazoMeses,
    cuota_centavos: c.cuotaCentavos,
    estado: c.estado,
    desembolsado_en: c.desembolsadoEn,
  };
}

export interface FilaCuota {
  id: string;
  credito_id: string;
  numero: number;
  fecha_vencimiento: string;
  capital_centavos: number;
  interes_centavos: number;
  capital_pagado_centavos: number;
  interes_pagado_centavos: number;
  mora_pagada_centavos: number;
}

export function aCuota(fila: FilaCuota): Cuota {
  return {
    id: fila.id,
    creditoId: fila.credito_id,
    numero: fila.numero,
    fechaVencimiento: fila.fecha_vencimiento,
    capitalCentavos: Number(fila.capital_centavos),
    interesCentavos: Number(fila.interes_centavos),
    capitalPagadoCentavos: Number(fila.capital_pagado_centavos),
    interesPagadoCentavos: Number(fila.interes_pagado_centavos),
    moraPagadaCentavos: Number(fila.mora_pagada_centavos),
  };
}

export function aFilaCuotaNueva(
  creditoId: string,
  c: Cuota,
): Omit<FilaCuota, "id"> {
  return {
    credito_id: creditoId,
    numero: c.numero,
    fecha_vencimiento: c.fechaVencimiento,
    capital_centavos: c.capitalCentavos,
    interes_centavos: c.interesCentavos,
    capital_pagado_centavos: c.capitalPagadoCentavos,
    interes_pagado_centavos: c.interesPagadoCentavos,
    mora_pagada_centavos: c.moraPagadaCentavos,
  };
}
