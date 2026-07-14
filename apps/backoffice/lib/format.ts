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

/** Edad en años cumplidos a partir de una fecha de nacimiento ISO (yyyy-mm-dd). */
export function edadDesde(fechaNacimientoIso: string, hoy: Date = new Date()): number {
  const nacimiento = new Date(`${fechaNacimientoIso}T00:00:00`);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}
