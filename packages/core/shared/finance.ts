// Matemática financiera compartida entre módulos (originación estima la cuota,
// cartera genera el plan completo — DEBEN coincidir exactamente).
// Las TASAS son fracciones (no dinero): float intermedio es aceptable.
// El DINERO entra y sale como enteros en centavos, con redondeo explícito.

// Tasa efectiva anual → tasa efectiva mensual: (1 + EA)^(1/12) - 1
export function tasaMensualDesdeEA(tasaEA: number): number {
  return Math.pow(1 + tasaEA, 1 / 12) - 1;
}

// Tasa efectiva anual → tasa efectiva diaria (para interés moratorio por días vencidos)
export function tasaDiariaDesdeEA(tasaEA: number): number {
  return Math.pow(1 + tasaEA, 1 / 365) - 1;
}

// Cuota fija de amortización francesa: M·i / (1 - (1+i)^-n), redondeada al centavo.
export function cuotaMensualFrancesaCentavos(
  montoCentavos: number,
  tasaEA: number,
  plazoMeses: number,
): number {
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) {
    throw new Error(`monto inválido: ${montoCentavos} (entero en centavos > 0)`);
  }
  if (plazoMeses <= 0 || !Number.isInteger(plazoMeses)) {
    throw new Error(`plazo inválido: ${plazoMeses}`);
  }
  const i = tasaMensualDesdeEA(tasaEA);
  if (i === 0) {
    return Math.ceil(montoCentavos / plazoMeses);
  }
  const cuota = (montoCentavos * i) / (1 - Math.pow(1 + i, -plazoMeses));
  return Math.round(cuota);
}
