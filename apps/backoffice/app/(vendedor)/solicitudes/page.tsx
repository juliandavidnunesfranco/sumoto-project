// "Mis solicitudes" — 100% SSR sobre la fachada de reporteria, paginada.
// Alcance por ROL: el vendedor ve las que ÉL originó (creado_por); el
// manager ve las de su tienda. Orden, búsqueda y filtros POR COLUMNA se
// narran en la URL; crearTableQuery los recolecta de las mismas columnas
// que renderiza TablaDatos y el core los aplica con su mapa (whitelist).

import Link from "next/link";
import type { FiltrosSolicitudes } from "@sumo/contracts";
import type { SolicitudReciente } from "@sumo/core";
import { obtenerSesion } from "@/lib/auth";
import { catalogoService, reporteriaService } from "@/lib/core-server";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaDatos } from "@/components/shared/tabla-datos";
import { columnasSolicitudes } from "@/components/shared/columnas-solicitudes";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";
import { crearTableQuery, hrefConParams } from "@/lib/tabla.query";

export const dynamic = "force-dynamic";

export default async function MisSolicitudes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const porPagina = [10, 20, 40, 50].includes(Number(params.porPagina))
    ? Number(params.porPagina)
    : 10;

  const sesion = await obtenerSesion();

  // el catálogo va primero: las columnas necesitan las motos para armar
  // las opciones de su filtro, y crearTableQuery lee esas columnas
  const catalogoMotos = sesion?.tiendaId
    ? await catalogoService().buscarMotos({ pagina: 1, porPagina: 50 })
    : { items: [], total: 0 };

  const columnas = columnasSolicitudes({
    motos: catalogoMotos.items.map((m) => m.nombre),
  });
  const tableQuery = crearTableQuery<SolicitudReciente, FiltrosSolicitudes>(
    params,
    columnas,
  );

  // vendedor → sus propias solicitudes; manager → las de su tienda.
  // Sin tienda asignada = estado anómalo: vacío, nunca alcance nacional.
  const { items: solicitudes, total } = sesion?.tiendaId
    ? await reporteriaService().solicitudesPaginadas(sesion.empresaId, {
        ...(sesion.rol === "vendedor"
          ? { creadoPor: sesion.userId }
          : { tiendaId: sesion.tiendaId }),
        query: params.solQuery,
        ...tableQuery,
        pagina,
        porPagina,
      })
    : { items: [], total: 0 };

  function hrefPagina(destino: number): string {
    const qs = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor && clave !== "pagina") qs.set(clave, valor);
    }
    qs.set("porPagina", String(porPagina));
    qs.set("pagina", String(destino));
    return `/solicitudes?${qs.toString()}`;
  }

  // Con criterios activos, cero filas significa "nada matchea" (mensaje
  // genérico de TablaDatos), no "aún no has creado" (CTA del wizard).
  const hayCriterios =
    Boolean(params.solQuery) || Object.keys(tableQuery.filtros).length > 0;

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
        <TablaDatos
          titulo="Solicitudes"
          busqueda={{ param: "solQuery", placeholder: "Cliente, cédula, moto o #id…" }}
          exportarHref={hrefConParams("/solicitudes/exportar", params)}
          columnas={columnas}
          filas={solicitudes}
          claveFila={(s) => s.solicitud_id}
          vacio={
            hayCriterios ? undefined : (
              <>
                Aún no hay solicitudes.{" "}
                <Link
                  href="/solicitudes/nueva"
                  className="font-medium text-primary hover:underline"
                >
                  Crea la primera
                </Link>
                .
              </>
            )
          }
        />
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
