// Sesión + perfil del usuario en el servidor (segunda puerta: cada ruta valida
// rol/tienda ella misma, sin confiar solo en el proxy).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./core-server";

export type Rol = "vendedor" | "manager" | "financiero" | "contable" | "ceo";

export interface Sesion {
  userId: string;
  email: string;
  nombre: string;
  rol: Rol;
  tiendaId: string | null;
}

export async function obtenerSesion(): Promise<Sesion | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabaseAdmin
    .from("perfiles")
    .select("rol, tienda_id, nombre")
    .eq("user_id", user.id)
    .single();
  if (!perfil) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    nombre: perfil.nombre,
    rol: perfil.rol as Rol,
    tiendaId: perfil.tienda_id,
  };
}

// Guarda para rutas API: devuelve la sesión o una Response 401/403 lista.
export async function exigirRol(
  permitidos: Rol[],
): Promise<Sesion | Response> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return Response.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!permitidos.includes(sesion.rol)) {
    return Response.json(
      { error: `rol ${sesion.rol} sin acceso a esta operación` },
      { status: 403 },
    );
  }
  return sesion;
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
