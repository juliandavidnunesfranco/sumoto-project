// Primera puerta de seguridad: guarda de roles por grupo de pantallas.
// (En Next 16 el archivo middleware.ts fue renombrado a proxy.ts.)
// La segunda puerta es exigirRol() en cada ruta API + RLS en la base.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Rol = "vendedor" | "manager" | "financiero" | "contable" | "ceo";

// prefijo de ruta → roles que pueden entrar
const ACCESOS: Array<[prefijo: string, roles: Rol[]]> = [
  ["/solicitudes", ["vendedor", "manager"]],
  ["/cartera", ["financiero"]],
  ["/politicas", ["financiero"]],
  ["/tienda", ["manager"]],
  ["/contabilidad", ["contable"]],
  ["/ceo", ["ceo"]],
];

export async function proxy(request: NextRequest) {
  const respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (aEscribir) => {
          for (const { name, value, options } of aEscribir) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const destino = request.nextUrl.pathname + request.nextUrl.search;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", destino);
    return NextResponse.redirect(loginUrl);
  }

  const regla = ACCESOS.find(([prefijo]) =>
    request.nextUrl.pathname.startsWith(prefijo),
  );
  if (regla) {
    // el usuario solo puede leer SU perfil (política RLS perfiles_lectura_propia)
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("user_id", user.id)
      .single();
    if (!perfil || !regla[1].includes(perfil.rol as Rol)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("denegado", "1");
      loginUrl.searchParams.set("next", destino);
      return NextResponse.redirect(loginUrl);
    }
  }

  return respuesta;
}

export const config = {
  matcher: [
    "/solicitudes/:path*",
    "/cartera/:path*",
    "/politicas/:path*",
    "/tienda/:path*",
    "/contabilidad/:path*",
    "/ceo/:path*",
  ],
};
