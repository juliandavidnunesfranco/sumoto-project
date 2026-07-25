// Cola de desembolso del financiero — apartado propio (antes vivía como
// tabla dentro de /cartera): cada solicitud aprobada abre su EXPEDIENTE
// (/desembolsos/[id]) donde se valida la información antes de desembolsar.

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import type { FiltrosSolicitudes } from "@sumo/contracts";
import type { SolicitudReciente } from "@sumo/core";
import { catalogoService, reporteriaService } from "@/lib/core-server";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaDatos } from "@/components/shared/tabla-datos";
import { columnasSolicitudes } from "@/components/shared/columnas-solicitudes";
import { crearTableQuery } from "@/lib/tabla.query";

export const dynamic = "force-dynamic";

export default async function DesembolsosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { error, desembolsada } = params;

  const catalogoMotos = await catalogoService().buscarMotos({
    pagina: 1,
    porPagina: 50,
  });

  // Alcance NACIONAL (el financiero desembolsa para todas las tiendas).
  // Decisión/estado son criterio FIJO: filtros forzados tras el spread.
  const columnas = columnasSolicitudes({
    conWizard: false,
    conVendedor: true,
    conDecision: false,
    conEstado: false,
    motos: catalogoMotos.items.map((m) => m.nombre),
    accionExtra: (s) => (
      <Link
        href={`/desembolsos/${s.solicitud_id}`}
        className="inline-flex items-center gap-1.5 border border-black px-3 py-1.5 font-headline text-xs font-bold transition-colors hover:bg-black hover:text-white"
      >
        <FolderOpen className="size-3.5" />
        Expediente
      </Link>
    ),
  });
  const tableQuery = crearTableQuery<SolicitudReciente, FiltrosSolicitudes>(
    params,
    columnas,
  );

  const pendientes = await reporteriaService().solicitudesPaginadas({
    query: params.desQuery,
    orden: tableQuery.orden,
    direccion: tableQuery.direccion,
    filtros: {
      ...tableQuery.filtros,
      decision: "APROBADO",
      estado: "evaluada",
    },
    pagina: 1,
    porPagina: 20,
  });

  return (
    <div>
      <PageHeader
        titulo="Desembolsos"
        descripcion="Solicitudes aprobadas por el motor esperando verificación del expediente y desembolso."
      />

      {error && (
        <p className="mb-4 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo desembolsar: {error}
        </p>
      )}
      {desembolsada && (
        <p className="mb-4 border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          Crédito desembolsado (solicitud #{desembolsada}): plan de cuotas
          generado y asiento contable en camino.
        </p>
      )}

      <Tarjeta className="overflow-x-auto">
        <TablaDatos
          titulo={
            <span className="block">
              Pendientes de desembolso
              <span className="block font-sans text-sm font-normal text-muted-foreground">
                aprobadas por el motor · todas las tiendas
              </span>
            </span>
          }
          busqueda={{
            param: "desQuery",
            placeholder: "Cliente, cédula, moto o #id…",
          }}
          columnas={columnas}
          filas={pendientes.items}
          claveFila={(s) => s.solicitud_id}
          vacio="No hay solicitudes aprobadas esperando desembolso."
        />
      </Tarjeta>
    </div>
  );
}
