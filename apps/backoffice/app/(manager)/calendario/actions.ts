"use server";

// Server action del calendario del manager: crear cita vía la fachada del
// core. tiendaId y creadoPor salen de la SESIÓN, nunca del formulario.

import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { agendaService } from "@/lib/core-server";
import type { TipoCita } from "@sumo/core";

export async function crearCita(formData: FormData): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion || !["vendedor", "manager"].includes(sesion.rol) || !sesion.tiendaId) {
    redirect("/login?denegado=1");
  }

  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const mes = fecha.slice(0, 7);

  const resultado = await agendaService().crearCita({
    tiendaId: sesion.tiendaId,
    creadoPor: sesion.userId,
    titulo: String(formData.get("titulo") ?? ""),
    tipo: String(formData.get("tipo") ?? "reunion") as TipoCita,
    clienteCedula: String(formData.get("clienteCedula") ?? "") || undefined,
    // el form manda hora LOCAL; se convierte a ISO con zona (UTC) — si el
    // string viaja "a secas", Postgres lo interpreta como UTC y la cita
    // queda corrida 5 horas (bug reportado: el banner no la mostraba)
    fechaHoraIso:
      fecha && hora ? new Date(`${fecha}T${hora}:00`).toISOString() : "",
    notas: String(formData.get("notas") ?? "") || undefined,
  });

  if (!resultado.ok) {
    redirect(
      `/calendario?mes=${mes}&error=${encodeURIComponent(resultado.error.join("|"))}`,
    );
  }
  redirect(`/calendario?mes=${mes}`);
}
