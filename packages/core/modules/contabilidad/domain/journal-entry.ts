// Asiento contable de partida doble. La invariante que no se negocia:
// suma de débitos === suma de créditos, al centavo.

import { exito, fallo, type Resultado } from "../../../kernel/result";

export interface Partida {
  cuentaCodigo: string;
  cuentaNombre: string;
  debitoCentavos: number;
  creditoCentavos: number;
}

export interface AsientoContable {
  id?: string;
  fecha: string; // ISO yyyy-mm-dd
  descripcion: string;
  eventoOrigen: string; // ej "cartera.pago.registrado"
  referenciaId: string; // id del pago/crédito que lo originó
  partidas: Partida[];
}

// Plan de cuentas mínimo de la demo (códigos estilo PUC, ajustables por Julián)
export const CUENTAS = {
  cartera: { codigo: "130505", nombre: "Cartera de créditos" },
  bancos: { codigo: "111005", nombre: "Bancos" },
  ingresoIntereses: { codigo: "421005", nombre: "Ingresos por intereses" },
  ingresoMora: { codigo: "421010", nombre: "Intereses de mora" },
  anticipos: { codigo: "280505", nombre: "Anticipos y avances recibidos" },
} as const;

export function debito(
  cuenta: { codigo: string; nombre: string },
  montoCentavos: number,
): Partida {
  return {
    cuentaCodigo: cuenta.codigo,
    cuentaNombre: cuenta.nombre,
    debitoCentavos: montoCentavos,
    creditoCentavos: 0,
  };
}

export function credito(
  cuenta: { codigo: string; nombre: string },
  montoCentavos: number,
): Partida {
  return {
    cuentaCodigo: cuenta.codigo,
    cuentaNombre: cuenta.nombre,
    debitoCentavos: 0,
    creditoCentavos: montoCentavos,
  };
}

// Única fábrica de asientos: valida la partida doble antes de que exista.
export function crearAsiento(
  datos: Omit<AsientoContable, "id" | "partidas">,
  partidas: Partida[],
): Resultado<AsientoContable, string[]> {
  const violaciones: string[] = [];

  // partidas en cero no aportan: se filtran (ej: pago sin mora)
  const efectivas = partidas.filter(
    (p) => p.debitoCentavos > 0 || p.creditoCentavos > 0,
  );

  if (efectivas.length < 2) {
    violaciones.push("un asiento requiere al menos dos partidas");
  }
  for (const p of efectivas) {
    if (!Number.isInteger(p.debitoCentavos) || !Number.isInteger(p.creditoCentavos)) {
      violaciones.push(`partida ${p.cuentaCodigo}: montos deben ser enteros en centavos`);
    }
    if (p.debitoCentavos > 0 && p.creditoCentavos > 0) {
      violaciones.push(`partida ${p.cuentaCodigo}: no puede ser débito y crédito a la vez`);
    }
  }

  const debitos = efectivas.reduce((s, p) => s + p.debitoCentavos, 0);
  const creditos = efectivas.reduce((s, p) => s + p.creditoCentavos, 0);
  if (debitos !== creditos) {
    violaciones.push(
      `asiento descuadrado: débitos ${debitos} ≠ créditos ${creditos} (centavos)`,
    );
  }

  if (violaciones.length > 0) return fallo(violaciones);
  return exito({ ...datos, partidas: efectivas });
}
