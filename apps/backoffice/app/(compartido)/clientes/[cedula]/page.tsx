// Tabla de casos de UN cliente — compartida por todos los roles, 100% SSR.
// Alcance de datos por rol: vendedor/manager solo ven al cliente (y sus
// solicitudes) si pertenece a su tienda; financiero/contable/ceo, nacional.
// El wizard y "reasignar" solo aparecen para los roles que pueden usarlos.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { FiltrosSolicitudes } from "@sumo/contracts";
import type { SolicitudReciente } from "@sumo/core";
import { obtenerSesion } from "@/lib/auth";
import { catalogoService, clientesService, reporteriaService } from "@/lib/core-server";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaDatos } from "@/components/shared/tabla-datos";
import { columnasSolicitudes } from "@/components/shared/columnas-solicitudes";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";
import { crearTableQuery } from "@/lib/tabla.query";

export const dynamic = "force-dynamic";

const ROLES_NACIONALES = ["financiero", "contable", "ceo"];

export default async function CasosDelCliente({
  params,
  searchParams,
}: {
  params: Promise<{ cedula: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { cedula } = await params;
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const porPagina = [10, 20, 40, 50].includes(Number(sp.porPagina))
    ? Number(sp.porPagina)
    : 10;

  const sesion = await obtenerSesion();
  const alcanceNacional = sesion ? ROLES_NACIONALES.includes(sesion.rol) : false;

  // scoping: el core corre con SERVICE_ROLE — un rol de tienda solo ve al
  // cliente si es de SU tienda (URL ajena = "no encontrado", no datos ajenos)
  const clienteCrudo = sesion
    ? await clientesService().buscarPorCedula(cedula, sesion.empresaId)
    : null;
  const cliente =
    clienteCrudo && (alcanceNacional || clienteCrudo.tiendaId === sesion?.tiendaId)
      ? clienteCrudo
      : null;

  // el catálogo va primero: las columnas necesitan las motos para su filtro
  const catalogoMotos = cliente
    ? await catalogoService().buscarMotos({ pagina: 1, porPagina: 50 })
    : { items: [], total: 0 };

  const conWizard = sesion?.rol === "vendedor" || sesion?.rol === "manager";

  const columnas = columnasSolicitudes({
    conWizard,
    conReasignar: sesion?.rol === "manager",
    motos: catalogoMotos.items.map((m) => m.nombre),
  });
  const tableQuery = crearTableQuery<SolicitudReciente, FiltrosSolicitudes>(
    sp,
    columnas,
  );

  const { items: solicitudes, total } = cliente
    ? await reporteriaService().solicitudesPaginadas({
        clienteCedula: cliente.cedula,
        ...(alcanceNacional ? {} : { tiendaId: sesion!.tiendaId! }),
        query: sp.solQuery,
        ...tableQuery,
        pagina,
        porPagina,
      })
    : { items: [], total: 0 };

  function hrefPagina(destino: number): string {
    const qs = new URLSearchParams();
    for (const [clave, valor] of Object.entries(sp)) {
      if (valor && clave !== "pagina") qs.set(clave, valor);
    }
    qs.set("porPagina", String(porPagina));
    qs.set("pagina", String(destino));
    return `/clientes/${cedula}?${qs.toString()}`;
  }

  return (
    <div>
      <Link
        href="/buscar"
        className="mb-4 border border-transparent  inline-flex items-center gap-1.5 font-headline text-sm text-black transition-colors duration-150 hover:text-muted-foreground hover:border-black p-1.5"
      >
        <ArrowLeft className="size-4" />
        Volver a la búsqueda
      </Link>

      {!cliente ? (
        <Tarjeta>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Cliente no encontrado.
          </p>
        </Tarjeta>
      ) : (
        <>
          <PageHeader
            titulo={`${cliente.nombres} ${cliente.apellidos}`}
            descripcion={`CC ${cliente.cedula} · ${cliente.ciudad}${cliente.telefono ? ` · ${cliente.telefono}` : ""}`}
          />

          <Tarjeta className="overflow-x-auto">
            <TablaDatos
              titulo="Casos del cliente"
              busqueda={{ param: "solQuery", placeholder: "Moto, vendedor o #id…" }}
              columnas={columnas}
              filas={solicitudes}
              claveFila={(s) => s.solicitud_id}
              vacio="Este cliente aún no tiene solicitudes."
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <SelectorPorPagina param="porPagina" resetParam="pagina" />
              <Paginacion
                pagina={pagina}
                porPagina={porPagina}
                total={total}
                hrefPagina={hrefPagina}
                sustantivo={["caso", "casos"]}
              />
            </div>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
