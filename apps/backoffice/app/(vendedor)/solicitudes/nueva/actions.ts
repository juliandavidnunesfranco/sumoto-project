"use server";

// Server actions del flujo del vendedor: reciben el form, validan FORMA con
// los schemas de @sumo/contracts, llaman la fachada del core y redirigen.
// El estado del wizard viaja en searchParams (SSR puro, funciona sin JS).

import { EvaluarSolicitudRequestSchema } from "@sumo/contracts";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { clientesService, originacionService } from "@/lib/core-server";
import { pesosACentavos } from "@/lib/format";

function conError(errores: string[]): never {
  redirect(`/solicitudes/nueva?error=${encodeURIComponent(errores.join("|"))}`);
}

async function sesionDeVendedor() {
  const sesion = await obtenerSesion();
  if (!sesion || !["vendedor", "manager"].includes(sesion.rol)) {
    redirect("/login?denegado=1");
  }
  if (!sesion.tiendaId) {
    conError(["el usuario no tiene tienda asignada"]);
  }
  return sesion;
}

export async function escanearCedula(formData: FormData): Promise<void> {
  const sesion = await sesionDeVendedor();
  const codigo = String(formData.get("cedula") ?? "").trim();

  const resultado = await clientesService().registrarCliente({
    fuente: "escaner",
    entradaCruda: { codigo },
    tiendaId: sesion.tiendaId!,
  });

  if (!resultado.ok) {
    conError(resultado.error);
  }
  redirect(`/solicitudes/nueva?cedula=${resultado.valor.cedula}`);
}

export async function evaluarSolicitud(formData: FormData): Promise<void> {
  const sesion = await sesionDeVendedor();

  const peticion = {
    clienteId: String(formData.get("clienteId") ?? ""),
    cedula: String(formData.get("cedula") ?? ""),
    productoId: String(formData.get("productoId") ?? ""),
    valorMotoCentavos: pesosACentavos(Number(formData.get("valorMoto") ?? 0)),
    cuotaInicialCentavos: pesosACentavos(Number(formData.get("cuotaInicial") ?? 0)),
    plazoMeses: Number(formData.get("plazo") ?? 0),
    ingresosDeclaradosCentavos: pesosACentavos(Number(formData.get("ingresos") ?? 0)),
  };

  const forma = EvaluarSolicitudRequestSchema.safeParse(peticion);
  if (!forma.success) {
    conError(forma.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }

  const resultado = await originacionService().evaluarSolicitud({
    ...forma.data,
    tiendaId: sesion.tiendaId!,
  });

  if (!resultado.ok) {
    conError(resultado.error);
  }
  redirect(`/solicitudes/nueva?solicitudId=${resultado.valor.solicitud.id}`);
}
