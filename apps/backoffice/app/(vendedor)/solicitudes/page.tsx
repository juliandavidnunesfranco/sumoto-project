// "Mis solicitudes" — 100% SSR sobre la fachada de reporteria, paginada.
// Alcance por ROL: el vendedor ve las que ÉL originó (creado_por); el
// manager ve las de su tienda. La tabla vive en components/shared/
// (la comparte el resumen de tienda del manager).

import { obtenerSesion } from "@/lib/auth";
import { catalogoService, reporteriaService } from "@/lib/core-server";
import { diaSiguiente } from "@/lib/format";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaSolicitudes } from "@/components/shared/tabla-solicitudes";
import { InputBusqueda } from "@/components/shared/input-busqueda";
import { FiltrosSolicitudes } from "@/components/shared/filtros-solicitudes";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";

export const dynamic = "force-dynamic";

export default async function MisSolicitudes({
  searchParams,
}: {
  searchParams: Promise<{
    pagina?: string;
    porPagina?: string;
    solQuery?: string;
    decision?: string;
    estado?: string;
    moto?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const porPagina = [10, 20, 40, 50].includes(Number(params.porPagina))
    ? Number(params.porPagina)
    : 10;

  const sesion = await obtenerSesion();

  // vendedor → sus propias solicitudes; manager → las de su tienda.
  // Sin tienda asignada = estado anómalo: vacío, nunca alcance nacional.
  const [{ items: solicitudes, total }, catalogoMotos] = sesion?.tiendaId
    ? await Promise.all([
        reporteriaService().solicitudesPaginadas({
          ...(sesion.rol === "vendedor"
            ? { creadoPor: sesion.userId }
            : { tiendaId: sesion.tiendaId }),
          query: params.solQuery,
          decision: params.decision,
          estado: params.estado,
          moto: params.moto,
          desdeFecha: params.desde,
          hastaFecha: params.hasta ? diaSiguiente(params.hasta) : undefined,
          pagina,
          porPagina,
        }),
        catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }),
      ])
    : [{ items: [], total: 0 }, { items: [], total: 0 }];

  function hrefPagina(destino: number): string {
    const qs = new URLSearchParams();
    for (const clave of ["solQuery", "decision", "estado", "moto", "desde", "hasta"] as const) {
      if (params[clave]) qs.set(clave, params[clave]!);
    }
    qs.set("porPagina", String(porPagina));
    qs.set("pagina", String(destino));
    return `/solicitudes?${qs.toString()}`;
  }

  return (
    <div>
      <PageHeader
        titulo="Mis solicitudes"
        descripcion={
          sesion?.rol === "manager"
            ? "Solicitudes de tu tienda: revisa la decisión o contacta al cliente."
            : "Solicitudes que originaste: retómalas, revisa la decisión o contacta al cliente."
        }
      />

      <Tarjeta className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <InputBusqueda
            param="solQuery"
            placeholder="Cliente, cédula, moto o #id…"
            limpiarParams={["pagina"]}
            className="w-64 sm:w-80"
          />
          <FiltrosSolicitudes motos={catalogoMotos.items.map((m) => m.nombre)} />
        </div>
        <div className="mt-4">
          <TablaSolicitudes solicitudes={solicitudes} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <SelectorPorPagina param="porPagina" resetParam="pagina" />
          <Paginacion
            pagina={pagina}
            porPagina={porPagina}
            total={total}
            hrefPagina={hrefPagina}
            sustantivo={["solicitud", "solicitudes"]}
          />
        </div>
      </Tarjeta>
    </div>
  );
}
