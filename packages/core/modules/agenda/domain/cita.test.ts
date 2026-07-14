import { describe, expect, it } from "vitest";
import { crearCita, type DatosCita } from "./cita";

const BASE: DatosCita = {
  tiendaId: "tienda-1",
  creadoPor: "manager-1",
  titulo: "Visita de cliente",
  tipo: "visita",
  fechaHoraIso: "2026-07-15T10:00:00",
};

describe("crearCita", () => {
  it("acepta una cita válida y normaliza espacios", () => {
    const r = crearCita({ ...BASE, titulo: "  Reunión  ", notas: "  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.titulo).toBe("Reunión");
    expect(r.valor.notas).toBeUndefined();
  });

  it("rechaza título vacío", () => {
    const r = crearCita({ ...BASE, titulo: "   " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("el título de la cita es obligatorio");
  });

  it("rechaza tipo desconocido", () => {
    const r = crearCita({ ...BASE, tipo: "almuerzo" as never });
    expect(r.ok).toBe(false);
  });

  it("rechaza fecha inválida", () => {
    const r = crearCita({ ...BASE, fechaHoraIso: "no-es-fecha" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("la fecha y hora de la cita no son válidas");
  });

  it("rechaza cita sin tienda o sin creador", () => {
    expect(crearCita({ ...BASE, tiendaId: " " }).ok).toBe(false);
    expect(crearCita({ ...BASE, creadoPor: "" }).ok).toBe(false);
  });
});
