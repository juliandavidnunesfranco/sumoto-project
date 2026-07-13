"use server";

// Server actions de administración de productos y políticas de crédito.
// Solo financiero puede crear productos y editar sus reglas (RLS + exigirRol).

import {
  ActualizarReglasRequestSchema,
  CrearProductoRequestSchema,
  SimularDecisionRequestSchema,
} from "@sumo/contracts";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { originacionService } from "@/lib/core-server";
import { pesosACentavos } from "@/lib/format";

function conError(errores: string[]): never {
  redirect(`/politicas?error=${encodeURIComponent(errores.join("|"))}`);
}

async function sesionDeFinanciero() {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) redirect("/login?denegado=1");
  return sesion;
}

export async function crearProducto(formData: FormData): Promise<void> {
  await sesionDeFinanciero();

  const forma = CrearProductoRequestSchema.safeParse({
    nombre: String(formData.get("nombre") ?? ""),
    tasaEA: Number(formData.get("tasaEA") ?? 0) / 100,
    plazoMinMeses: Number(formData.get("plazoMinMeses") ?? 0),
    plazoMaxMeses: Number(formData.get("plazoMaxMeses") ?? 0),
    reglasDecision: {
      scoreMinimo: Number(formData.get("scoreMinimo") ?? 0),
      scoreRevision: formData.get("scoreRevision")
        ? Number(formData.get("scoreRevision"))
        : undefined,
      cuotaMaximaPorcentajeIngreso: Number(formData.get("cuotaMaximaPorcentajeIngreso") ?? 0) / 100,
      ltvMaximo: Number(formData.get("ltvMaximo") ?? 0) / 100,
      ingresoMinimoCentavos: formData.get("ingresoMinimo")
        ? pesosACentavos(Number(formData.get("ingresoMinimo")))
        : undefined,
      moraMaximaDias: formData.get("moraMaximaDias")
        ? Number(formData.get("moraMaximaDias"))
        : undefined,
    },
  });
  if (!forma.success) {
    conError(forma.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }

  const resultado = await originacionService().crearProducto(forma.data);
  if (!resultado.ok) conError(resultado.error);

  redirect(`/politicas?productoId=${resultado.valor.id}`);
}

export async function actualizarReglas(formData: FormData): Promise<void> {
  await sesionDeFinanciero();

  const forma = ActualizarReglasRequestSchema.safeParse({
    productoId: String(formData.get("productoId") ?? ""),
    reglasDecision: {
      scoreMinimo: Number(formData.get("scoreMinimo") ?? 0),
      scoreRevision: formData.get("scoreRevision")
        ? Number(formData.get("scoreRevision"))
        : undefined,
      cuotaMaximaPorcentajeIngreso: Number(formData.get("cuotaMaximaPorcentajeIngreso") ?? 0) / 100,
      ltvMaximo: Number(formData.get("ltvMaximo") ?? 0) / 100,
      ingresoMinimoCentavos: formData.get("ingresoMinimo")
        ? pesosACentavos(Number(formData.get("ingresoMinimo")))
        : undefined,
      moraMaximaDias: formData.get("moraMaximaDias")
        ? Number(formData.get("moraMaximaDias"))
        : undefined,
    },
  });
  if (!forma.success) {
    conError(forma.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }

  const resultado = await originacionService().actualizarReglas(
    forma.data.productoId,
    forma.data.reglasDecision,
  );
  if (!resultado.ok) conError(resultado.error);

  redirect(`/politicas?productoId=${resultado.valor.id}&guardado=1`);
}

export async function simularDecision(formData: FormData): Promise<void> {
  await sesionDeFinanciero();
  const productoId = String(formData.get("productoId") ?? "");

  const forma = SimularDecisionRequestSchema.safeParse({
    cedula: String(formData.get("cedulaPrueba") ?? ""),
    valorMotoCentavos: pesosACentavos(Number(formData.get("valorMotoPrueba") ?? 0)),
    cuotaInicialCentavos: pesosACentavos(Number(formData.get("cuotaInicialPrueba") ?? 0)),
    plazoMeses: Number(formData.get("plazoPrueba") ?? 24),
    ingresosDeclaradosCentavos: pesosACentavos(Number(formData.get("ingresosPrueba") ?? 0)),
    tasaEA: Number(formData.get("tasaEAPrueba") ?? 0) / 100,
    reglasDecision: {
      scoreMinimo: Number(formData.get("scoreMinimo") ?? 0),
      scoreRevision: formData.get("scoreRevision")
        ? Number(formData.get("scoreRevision"))
        : undefined,
      cuotaMaximaPorcentajeIngreso: Number(formData.get("cuotaMaximaPorcentajeIngreso") ?? 0) / 100,
      ltvMaximo: Number(formData.get("ltvMaximo") ?? 0) / 100,
      ingresoMinimoCentavos: formData.get("ingresoMinimo")
        ? pesosACentavos(Number(formData.get("ingresoMinimo")))
        : undefined,
      moraMaximaDias: formData.get("moraMaximaDias")
        ? Number(formData.get("moraMaximaDias"))
        : undefined,
    },
  });
  if (!forma.success) {
    conError(forma.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }

  const resultado = await originacionService().simularDecision(forma.data);
  if (!resultado.ok) conError([resultado.error]);

  const params = new URLSearchParams({
    productoId,
    simResultado: resultado.valor.resultado,
    simScore: String(resultado.valor.score),
    simCuota: String(resultado.valor.cuotaEstimadaCentavos),
    simRazones: resultado.valor.razones.join("|"),
  });
  redirect(`/politicas?${params.toString()}`);
}
