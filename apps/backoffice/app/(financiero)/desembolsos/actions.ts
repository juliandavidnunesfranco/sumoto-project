"use server";

// Server actions del apartado de desembolsos (financiero): verificar el
// expediente, adjuntar documentos y desembolsar. La app solo traduce el
// form a comandos del core — reglas, montos y puertas viven allá.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  MarcarVerificacionRequestSchema,
  SubirDocumentoRequestSchema,
} from "@sumo/contracts";
import { CHECKLIST_DESEMBOLSO } from "@sumo/core";
import { exigirRol, type Sesion } from "@/lib/auth";
import { carteraService, originacionService } from "@/lib/core-server";

// yyyy-mm-dd en hora de Colombia: toISOString() es UTC y después de las
// 7 p. m. ya va en "mañana" — el desembolso quedaría con fecha corrida.
const FECHA_BOGOTA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
});

async function sesionDeFinanciero(): Promise<Sesion> {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) redirect("/login?denegado=1");
  return sesion;
}

export async function desembolsarSolicitud(formData: FormData): Promise<void> {
  await sesionDeFinanciero();

  const solicitudId = String(formData.get("solicitudId") ?? "");
  const resultado = await carteraService().desembolsarSolicitudAprobada({
    solicitudId,
    fechaDesembolso: FECHA_BOGOTA.format(new Date()),
  });

  if (!resultado.ok) {
    redirect(`/desembolsos/${solicitudId}?error=${encodeURIComponent(resultado.error)}`);
  }
  revalidatePath("/desembolsos");
  redirect(`/desembolsos?desembolsada=${solicitudId.slice(0, 8)}`);
}

// Guarda TODO el checklist de una vez: un checkbox HTML solo viaja cuando
// está marcado, así que "ausente en el form" = desmarcado. El catálogo del
// dominio es la whitelist — códigos ajenos jamás llegan al core.
export async function guardarVerificacion(formData: FormData): Promise<void> {
  const sesion = await sesionDeFinanciero();

  const solicitudId = String(formData.get("solicitudId") ?? "");
  const marcados = new Set(formData.getAll("item").map(String));

  for (const item of CHECKLIST_DESEMBOLSO) {
    const forma = MarcarVerificacionRequestSchema.safeParse({
      solicitudId,
      itemCodigo: item.codigo,
      marcado: marcados.has(item.codigo),
    });
    if (!forma.success) {
      redirect(`/desembolsos/${solicitudId}?error=${encodeURIComponent("datos inválidos")}`);
    }
    const resultado = await originacionService().marcarVerificacion({
      ...forma.data,
      marcadoPor: sesion.userId,
    });
    if (!resultado.ok) {
      redirect(`/desembolsos/${solicitudId}?error=${encodeURIComponent(resultado.error)}`);
    }
  }

  revalidatePath(`/desembolsos/${solicitudId}`);
  redirect(`/desembolsos/${solicitudId}?guardado=1`);
}

export async function subirDocumentoExpediente(formData: FormData): Promise<void> {
  await sesionDeFinanciero();

  const solicitudId = String(formData.get("solicitudId") ?? "");
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    redirect(`/desembolsos/${solicitudId}?error=${encodeURIComponent("selecciona un archivo")}`);
  }

  const forma = SubirDocumentoRequestSchema.safeParse({
    solicitudId,
    nombre: archivo.name,
    mime: archivo.type,
    tamanoBytes: archivo.size,
  });
  if (!forma.success) {
    conErrorDocumento(solicitudId, forma.error.issues.map((i) => i.message));
  }

  await originacionService().subirDocumento(
    forma.data.solicitudId,
    forma.data.nombre,
    await archivo.arrayBuffer(),
    forma.data.mime,
  );

  revalidatePath(`/desembolsos/${solicitudId}`);
  redirect(`/desembolsos/${solicitudId}?docSubido=1`);
}

function conErrorDocumento(solicitudId: string, errores: string[]): never {
  redirect(`/desembolsos/${solicitudId}?error=${encodeURIComponent(errores.join("|"))}`);
}
