// Búsqueda de clientes del vendedor — 100% SSR: el input del header solo
// narra ?q= (components/shared/input-busqueda); esta página consulta la
// fachada real del core (nunca Supabase directo) y renderiza resultados.
// Scoping por tienda replicando la RLS: vendedor/manager solo ven su tienda.

import Link from "next/link";
import { UserSearch } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { clientesService } from "@/lib/core-server";
import { PageHeader, Tarjeta } from "@/components/panel/ui";

export const dynamic = "force-dynamic";

export default async function BuscarClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termino = q?.trim() ?? "";
  const sesion = await obtenerSesion();

  // sin tienda asignada NO se busca (omitir tiendaId daría alcance nacional,
  // reservado a financiero/contable/ceo — misma regla que la RLS de lectura)
  const clientes =
    sesion?.tiendaId && termino.length >= 2
      ? await clientesService().buscarClientes(termino, sesion.tiendaId)
      : [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo="Buscar cliente"
        descripcion="Escribe en el buscador del encabezado: nombre, apellido o cédula."
      />

      <Tarjeta className="mt-2">
        {termino.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Escribe al menos 2 caracteres para buscar.
          </p>
        ) : clientes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados para «{termino}».
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {clientes.map((c) => (
              <li key={c.cedula}>
                <Link
                  href={`/solicitudes/nueva?cedula=${c.cedula}&paso=cliente`}
                  className="flex items-center justify-between gap-3 px-2 py-3 transition-colors duration-150 hover:bg-secondary"
                >
                  <span className="flex items-center gap-3">
                    <UserSearch className="size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block font-medium">
                        {c.nombres} {c.apellidos}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        CC {c.cedula} · {c.ciudad}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">Abrir solicitud →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
