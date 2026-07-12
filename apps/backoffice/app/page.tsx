import { redirect } from "next/navigation";
import { obtenerSesion, rutaInicial } from "@/lib/auth";

export default async function Inicio() {
  const sesion = await obtenerSesion();
  redirect(sesion ? rutaInicial(sesion.rol) : "/login");
}
