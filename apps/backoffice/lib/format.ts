// El dinero viaja en centavos; la UI solo formatea.

const formatoCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function pesos(centavos: number): string {
  return formatoCOP.format(Math.round(centavos / 100));
}

export function pesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}
