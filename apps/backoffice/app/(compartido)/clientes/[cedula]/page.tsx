// Tabla de casos de UN cliente — compartida por todos los roles, 100% SSR.
// Alcance de datos por rol: vendedor/manager solo ven al cliente (y sus
// solicitudes) si pertenece a su tienda; financiero/contable/ceo, nacional.
// El wizard y "reasignar" solo aparecen para los roles que pueden usarlos.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { catalogoService, clientesService, reporteriaService } from "@/lib/core-server";
import { diaSiguiente } from "@/lib/format";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaSolicitudes } from "@/components/shared/tabla-solicitudes";
import { FiltrosSolicitudes } from "@/components/shared/filtros-solicitudes";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";

export const dynamic = "force-dynamic";

const ROLES_NACIONALES = ["financiero", "contable", "ceo"];

export default async function CasosDelCliente({
  params,
  searchParams,
}: {
  params: Promise<{ cedula: string }>;
  searchParams: Promise<{
    pagina?: string;
    porPagina?: string;
    decision?: string;
    estado?: string;
    moto?: string;
    desde?: string;
    hasta?: string;
  }>;
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
  const clienteCrudo = sesion ? await clientesService().buscarPorCedula(cedula) : null;
  const cliente =
    clienteCrudo && (alcanceNacional || clienteCrudo.tiendaId === sesion?.tiendaId)
      ? clienteCrudo
      : null;

  const [{ items: solicitudes, total }, catalogoMotos] = cliente
    ? await Promise.all([
        reporteriaService().solicitudesPaginadas({
          clienteCedula: cliente.cedula,
          ...(alcanceNacional ? {} : { tiendaId: sesion!.tiendaId! }),
          decision: sp.decision,
          estado: sp.estado,
          moto: sp.moto,
          desdeFecha: sp.desde,
          hastaFecha: sp.hasta ? diaSiguiente(sp.hasta) : undefined,
          pagina,
          porPagina,
        }),
        catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }),
      ])
    : [{ items: [], total: 0 }, { items: [], total: 0 }];

  function hrefPagina(destino: number): string {
    const qs = new URLSearchParams();
    for (const clave of ["decision", "estado", "moto", "desde", "hasta"] as const) {
      if (sp[clave]) qs.set(clave, sp[clave]!);
    }
    qs.set("porPagina", String(porPagina));
    qs.set("pagina", String(destino));
    return `/clientes/${cedula}?${qs.toString()}`;
  }

  const conWizard = sesion?.rol === "vendedor" || sesion?.rol === "manager";

  return (
    <div>
      <Link
        href="/buscar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold font-headline text-3xl">Casos del cliente</h2>
              <FiltrosSolicitudes motos={catalogoMotos.items.map((m) => m.nombre)} />
            </div>
            <div className="mt-4">
              <TablaSolicitudes
                solicitudes={solicitudes}
                conWizard={conWizard}
                conReasignar={sesion?.rol === "manager"}
              />
            </div>
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
