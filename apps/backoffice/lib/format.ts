// El dinero viaja en centavos; la UI solo formatea.

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const formatoCOPCompacto = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function pesos(centavos: number): string {
  return formatoCOP.format(Math.round(centavos / 100));
}

/** Versión compacta para tarjetas de KPI: 1250000000000 -> "$12,5 mil M". */
export function pesosCompacto(centavos: number): string {
  return formatoCOPCompacto.format(Math.round(centavos / 100));
}

export function pesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}
