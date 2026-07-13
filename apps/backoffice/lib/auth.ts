// Sesión en el servidor. La app solo maneja el PLUMBING (cookies de Supabase
// Auth, el proveedor de identidad); el PERFIL (rol/tienda) lo resuelve el core
// vía el módulo seguridad. Segunda puerta: cada ruta/action valida rol aquí.

import { createServerClient } from "@supabase/ssr";
import type { Perfil, Rol } from "@sumo/core";
import { cookies } from "next/headers";
import { seguridadService } from "./core-server";

export type { Rol };

export interface Sesion extends Perfil {
  email: string;
}

export async function clienteSupabaseAuth() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (aEscribir) => {
          try {
            for (const { name, value, options } of aEscribir) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // en server components no se pueden escribir cookies: el proxy refresca
          }
        },
      },
    },
  );
}

export async function obtenerSesion(): Promise<Sesion | null> {
  const supabase = await clienteSupabaseAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const perfil = await seguridadService().perfilDe(user.id);
  return perfil ? { ...perfil, email: user.email ?? "" } : null;
}

// Guarda para rutas API y server actions. La POLÍTICA de autorización la
// decide el core (SeguridadService.tieneAcceso); aquí solo se traduce a HTTP.
export async function exigirRol(permitidos: Rol[]): Promise<Sesion | Response> {
  const supabase = await clienteSupabaseAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "no autenticado" }, { status: 401 });
  }

  const perfil = await seguridadService().tieneAcceso(user.id, permitidos);
  if (!perfil) {
    return Response.json(
      { error: "tu rol no tiene acceso a esta operación" },
      { status: 403 },
    );
  }
  return { ...perfil, email: user.email ?? "" };
}

export function rutaInicial(rol: Rol): string {
  switch (rol) {
    case "vendedor":
    case "manager":
      return "/solicitudes/nueva";
    default:
      return "/cartera";
  }
}
