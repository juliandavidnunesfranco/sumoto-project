"use server";

// Server actions del flujo del vendedor: reciben el form, validan FORMA con
// los schemas de @sumo/contracts, llaman la fachada del core y redirigen.
// El estado del wizard viaja en searchParams (SSR puro, funciona sin JS).

import { EvaluarSolicitudRequestSchema } from "@sumo/contracts";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { clientesService, originacionService } from "@/lib/core-server";
import { CARGOS_ADICIONALES_DEMO } from "@/lib/cargos-adicionales";
import { pesosACentavos } from "@/lib/format";

function conError(errores: string[], contexto = ""): never {
  redirect(`/solicitudes/nueva?error=${encodeURIComponent(errores.join("|"))}${contexto}`);
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
  // Se queda en el paso "cliente" — el vendedor avanza a "moto" manualmente
  // (el wizard no salta de pestaña solo).
  redirect(`/solicitudes/nueva?cedula=${resultado.valor.cedula}&paso=cliente`);
}

export async function evaluarSolicitud(formData: FormData): Promise<void> {
  const sesion = await sesionDeVendedor();
  const cedula = String(formData.get("cedula") ?? "");
  const motoId = String(formData.get("motoId") ?? "");
  const contexto = `&cedula=${cedula}${motoId ? `&motoId=${motoId}` : ""}&paso=credito`;

  const peticion = {
    clienteId: String(formData.get("clienteId") ?? ""),
    cedula,
    productoId: String(formData.get("productoId") ?? ""),
    motoId,
    valorMotoCentavos: pesosACentavos(Number(formData.get("valorMoto") ?? 0)),
    cuotaInicialCentavos: pesosACentavos(Number(formData.get("cuotaInicial") ?? 0)),
    // del form solo llegan IDs; el monto se resuelve AQUÍ (lado servidor) —
    // un form manipulado no puede enviar montos arbitrarios
    cargosAdicionalesCentavos: formData
      .getAll("cargo")
      .reduce<number>((suma, id) => {
        const cargo = CARGOS_ADICIONALES_DEMO.find((c) => c.id === id);
        return suma + (cargo?.montoCentavos ?? 0);
      }, 0),
    plazoMeses: Number(formData.get("plazo") ?? 0),
    ingresosDeclaradosCentavos: pesosACentavos(Number(formData.get("ingresos") ?? 0)),
  };

  const forma = EvaluarSolicitudRequestSchema.safeParse(peticion);
  if (!forma.success) {
    conError(forma.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), contexto);
  }

  // tiendaId y creadoPor salen de la SESIÓN, nunca del formulario:
  // el navegador no puede atribuir la solicitud a otro vendedor/tienda
  const resultado = await originacionService().evaluarSolicitud({
    ...forma.data,
    tiendaId: sesion.tiendaId!,
    creadoPor: sesion.userId,
  });

  if (!resultado.ok) {
    conError(resultado.error, contexto);
  }
  redirect(
    `/solicitudes/nueva?solicitudId=${resultado.valor.solicitud.id}&cedula=${cedula}${motoId ? `&motoId=${motoId}` : ""}`,
  );
}
