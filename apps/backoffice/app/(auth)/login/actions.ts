"use server";

// Login 100% del lado servidor: la action recibe el form, autentica contra
// Supabase Auth (las cookies de sesión se escriben aquí) y redirige por rol.

import { LoginRequestSchema } from "@sumo/contracts";
import { redirect } from "next/navigation";
import { clienteSupabaseAuth, obtenerSesion, rutaInicial } from "@/lib/auth";

// Evita open-redirect: "next" viene de un query param que el usuario puede
// manipular, solo se acepta una ruta interna relativa (nunca otro host).
function siguienteSeguro(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string" || next.length === 0) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function ingresar(formData: FormData): Promise<void> {
  const siguiente = siguienteSeguro(formData.get("next"));
  const sufijoNext = siguiente ? `&next=${encodeURIComponent(siguiente)}` : "";

  const forma = LoginRequestSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!forma.success) {
    redirect(`/login?error=faltan-datos${sufijoNext}`);
  }

  const supabase = await clienteSupabaseAuth();
  const { error } = await supabase.auth.signInWithPassword(forma.data);
  if (error) {
    redirect(`/login?error=credenciales${sufijoNext}`);
  }

  const sesion = await obtenerSesion();
  if (!sesion) {
    redirect(`/login?error=sin-perfil${sufijoNext}`);
  }
  redirect(siguiente ?? rutaInicial(sesion.rol));
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await clienteSupabaseAuth();
  await supabase.auth.signOut();
  redirect("/");
}
