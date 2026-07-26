// Búsqueda de clientes — compartida por TODOS los roles, 100% SSR: el input
// del header solo narra ?q= (components/shared/input-busqueda); esta página
// consulta la fachada real del core y renderiza resultados. Alcance de datos
// por rol: vendedor/manager solo su tienda (misma regla que la RLS);
// financiero/contable/ceo alcance nacional. Cada resultado abre la TABLA DE
// CASOS del cliente (/clientes/[cedula]), no el wizard.

import Link from "next/link";
import { UserSearch } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { clientesService } from "@/lib/core-server";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { InputBusqueda } from "@/components/shared/input-busqueda";

export const dynamic = "force-dynamic";

const ROLES_NACIONALES = ["financiero", "contable", "ceo"];

export default async function BuscarClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termino = q?.trim() ?? "";
  const sesion = await obtenerSesion();

  const alcanceNacional = sesion ? ROLES_NACIONALES.includes(sesion.rol) : false;
  // rol de tienda sin tienda asignada = estado anómalo: no se busca nada
  const puedeBuscar = sesion && (alcanceNacional || !!sesion.tiendaId);

  const clientes =
    puedeBuscar && termino.length >= 2
      ? await clientesService().buscarClientes(
          termino,
          sesion.empresaId,
          alcanceNacional ? undefined : sesion.tiendaId!,
        )
      : [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo="Buscar cliente"
        descripcion="Escribe en el buscador: nombre, apellido o cédula."
      />

      <div className="p-4">
        <InputBusqueda
          param="q"          
          placeholder="Buscar por nombre, cedula"
          className="w-full max-w-3xl"
          />
      </div>

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
                  href={`/clientes/${c.cedula}`}
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
                  <span className="text-xs text-muted-foreground">Ver casos →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}
