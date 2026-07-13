"use server";

// Login 100% del lado servidor: la action recibe el form, autentica contra
// Supabase Auth (las cookies de sesión se escriben aquí) y redirige por rol.

import { LoginRequestSchema } from "@sumo/contracts";
import { redirect } from "next/navigation";
import { clienteSupabaseAuth, obtenerSesion, rutaInicial } from "@/lib/auth";

export async function ingresar(formData: FormData): Promise<void> {
  const forma = LoginRequestSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!forma.success) {
    redirect("/login?error=faltan-datos");
  }

  const supabase = await clienteSupabaseAuth();
  const { error } = await supabase.auth.signInWithPassword(forma.data);  
  if (error) {
    redirect("/login?error=credenciales");
  }

  const sesion = await obtenerSesion();
  if (!sesion) {
    redirect("/login?error=sin-perfil");
  }
  redirect(rutaInicial(sesion.rol));
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await clienteSupabaseAuth();
  await supabase.auth.signOut();
  redirect("/");
}
