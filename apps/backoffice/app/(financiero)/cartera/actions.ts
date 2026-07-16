"use server";

// Server action del financiero: desembolsar una solicitud APROBADA.
// La app solo manda el id — montos, tasas y validaciones viven en el core
// (DesembolsarSolicitudAprobada → workflow con compensación).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { carteraService } from "@/lib/core-server";

// yyyy-mm-dd en hora de Colombia: toISOString() es UTC y después de las
// 7 p. m. ya va en "mañana" — el desembolso quedaría con fecha corrida.
const FECHA_BOGOTA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
});

export async function desembolsarSolicitud(formData: FormData): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "financiero") {
    redirect("/login?denegado=1");
  }

  const solicitudId = String(formData.get("solicitudId") ?? "");
  const resultado = await carteraService().desembolsarSolicitudAprobada({
    solicitudId,
    fechaDesembolso: FECHA_BOGOTA.format(new Date()),
  });

  if (!resultado.ok) {
    redirect(`/cartera?error=${encodeURIComponent(resultado.error)}`);
  }
  revalidatePath("/cartera");
  redirect(`/cartera?desembolsada=${solicitudId.slice(0, 8)}`);
}
