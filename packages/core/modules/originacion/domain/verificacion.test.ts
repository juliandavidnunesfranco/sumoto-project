import { describe, expect, it } from "vitest";
import {
  CHECKLIST_DESEMBOLSO,
  esCodigoDeChecklist,
  evaluarVerificacion,
  PUNTAJE_MINIMO_VERIFICACION,
} from "./verificacion";

const OBLIGATORIOS = CHECKLIST_DESEMBOLSO.filter((i) => i.obligatorio).map((i) => i.codigo);
const PONDERADOS = CHECKLIST_DESEMBOLSO.filter((i) => !i.obligatorio);

describe("evaluarVerificacion (expediente pre-desembolso)", () => {
  it("expediente vacío: incompleto, con TODOS los obligatorios como razones", () => {
    const estado = evaluarVerificacion([]);
    expect(estado.completa).toBe(false);
    expect(estado.puntaje).toBe(0);
    expect(estado.faltantesObligatorios).toHaveLength(OBLIGATORIOS.length);
    // explicabilidad: una razón por obligatorio + una de completitud
    expect(estado.razones.length).toBe(OBLIGATORIOS.length + 1);
  });

  it("obligatorios completos pero sin puntaje mínimo: sigue incompleto", () => {
    const estado = evaluarVerificacion(OBLIGATORIOS);
    expect(estado.faltantesObligatorios).toEqual([]);
    expect(estado.completa).toBe(false);
    expect(estado.razones.some((r) => r.includes("mínimo"))).toBe(true);
  });

  it("puntaje suficiente pero falta UN obligatorio: bloquea con razón visible", () => {
    const marcados = [
      ...OBLIGATORIOS.slice(1), // falta el primero
      ...PONDERADOS.map((i) => i.codigo),
    ];
    const estado = evaluarVerificacion(marcados);
    expect(estado.completa).toBe(false);
    expect(estado.faltantesObligatorios).toHaveLength(1);
  });

  it("todo marcado: completa, puntaje = máximo", () => {
    const estado = evaluarVerificacion(CHECKLIST_DESEMBOLSO.map((i) => i.codigo));
    expect(estado.completa).toBe(true);
    expect(estado.puntaje).toBe(estado.puntajeMaximo);
  });

  it("umbral exacto: los ponderados que suman justo el mínimo aprueban", () => {
    // greedy: acumula ponderados hasta cruzar el umbral
    const acumulados: string[] = [];
    let suma = 0;
    for (const item of PONDERADOS) {
      if (suma >= PUNTAJE_MINIMO_VERIFICACION) break;
      acumulados.push(item.codigo);
      suma += item.puntos;
    }
    const estado = evaluarVerificacion([...OBLIGATORIOS, ...acumulados]);
    expect(estado.puntaje).toBeGreaterThanOrEqual(PUNTAJE_MINIMO_VERIFICACION);
    expect(estado.completa).toBe(true);
  });

  it("códigos desconocidos se ignoran (el catálogo es la whitelist)", () => {
    const estado = evaluarVerificacion(["hackeado", "otro-raro"]);
    expect(estado.puntaje).toBe(0);
    expect(estado.completa).toBe(false);
    expect(esCodigoDeChecklist("hackeado")).toBe(false);
    expect(esCodigoDeChecklist("sarlaft")).toBe(true);
  });

  it("el máximo ponderado alcanza para superar el mínimo (catálogo coherente)", () => {
    const maximo = PONDERADOS.reduce((s, i) => s + i.puntos, 0);
    expect(maximo).toBeGreaterThanOrEqual(PUNTAJE_MINIMO_VERIFICACION);
  });
});
