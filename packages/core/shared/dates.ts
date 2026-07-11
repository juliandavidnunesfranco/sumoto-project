// Fechas de negocio como strings ISO (yyyy-mm-dd), sin zona horaria:
// una cuota vence un DÍA calendario, no un instante.

// Suma meses ajustando al último día cuando el mes destino es más corto
// (31 ene + 1 mes = 28/29 feb, no 3 mar).
export function agregarMeses(fechaIso: string, meses: number): string {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const totalMeses = anio * 12 + (mes - 1) + meses;
  const anioDestino = Math.floor(totalMeses / 12);
  const mesDestino = (totalMeses % 12) + 1;
  const ultimoDia = new Date(anioDestino, mesDestino, 0).getDate();
  const diaDestino = Math.min(dia, ultimoDia);
  return `${anioDestino}-${String(mesDestino).padStart(2, "0")}-${String(diaDestino).padStart(2, "0")}`;
}

// Días calendario entre dos fechas ISO (positivo si `hasta` es posterior)
export function diasEntre(desdeIso: string, hastaIso: string): number {
  const desde = Date.UTC(...descomponer(desdeIso));
  const hasta = Date.UTC(...descomponer(hastaIso));
  return Math.round((hasta - desde) / 86_400_000);
}

function descomponer(fechaIso: string): [number, number, number] {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return [anio, mes - 1, dia];
}
