// Dashboard de cartera (financiero): server component que consulta la
// fachada ReporteriaService del core — la app jamás toca la base directo.

import { BanknoteArrowDown } from "lucide-react";
import type { FiltrosRecaudoMensual, FiltrosSolicitudes } from "@sumo/contracts";
import type { SolicitudReciente } from "@sumo/core";
import { catalogoService, reporteriaService } from "@/lib/core-server";
import { pesos, pesosCompacto } from "@/lib/format";
import { BarraHorizontal, Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { desembolsarSolicitud } from "./actions";
import { TablaDatos, type ColumnaDatos } from "@/components/shared/tabla-datos";
import { columnasSolicitudes } from "@/components/shared/columnas-solicitudes";
import { crearTableQuery, hrefConParams } from "@/lib/tabla.query";

export const dynamic = "force-dynamic";

const ORDEN_FRANJAS = ["0-30", "31-60", "61-90", "90+"] as const;

const COLORES_FRANJAS: Record<string, string> = {
  "0-30": "bg-emerald-500",
  "31-60": "bg-amber-500",
  "61-90": "bg-orange-500",
  "90+": "bg-destructive",
};

type RecaudoMensual = Awaited<
  ReturnType<ReturnType<typeof reporteriaService>["recaudoMensual"]>
>[number];

// Cada columna declara su filtro: mes por rango de fechas, las numéricas
// con comparador ("op:valor"); factor 100 = el usuario escribe pesos y la
// URL viaja en centavos (la unidad de la vista).
const COLUMNAS: ColumnaDatos<RecaudoMensual>[] = [
  {
    titulo: "Mes",
    claveOrden: "mes",
    filtro: {
      param: "mes",
      tipo: "rango-fechas",
      paramDesde: "mesDesde",
      paramHasta: "mesHasta",
    },
    render: (r) => r.mes.slice(0, 7),
  },
  {
    titulo: "Pagos",
    claveOrden: "pagos",
    filtro: { param: "pagos", tipo: "numero", placeholder: "Cantidad…" },
    alinear: "izquierda",
    render: (r) => r.pagos,
  },
  {
    titulo: "Capital",
    claveOrden: "capital_centavos",
    filtro: { param: "capital", tipo: "numero", factor: 100, placeholder: "Pesos…" },
    alinear: "izquierda",
    render: (r) => pesos(r.capital_centavos),
    clasesCelda: "font-medium",
  },
  {
    titulo: "Interés",
    claveOrden: "interes_centavos",
    filtro: { param: "interes", tipo: "numero", factor: 100, placeholder: "Pesos…" },
    alinear: "izquierda",
    render: (r) => pesos(r.interes_centavos),
    clasesCelda: "text-emerald-400",
  },
  {
    titulo: "Mora",
    claveOrden: "mora_centavos",
    filtro: { param: "mora", tipo: "numero", factor: 100, placeholder: "Pesos…" },
    alinear: "izquierda",
    render: (r) => pesos(r.mora_centavos),
    clasesCelda: "text-amber-400",
  },
  {
    titulo: "Total",
    claveOrden: "recaudo_centavos",
    filtro: { param: "recaudo", tipo: "numero", factor: 100, placeholder: "Pesos…" },
    alinear: "izquierda",
    render: (r) => pesos(r.recaudo_centavos),
    clasesCelda: "font-semibold",
  },
];


export default async function DashboardCartera({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { error, desembolsada } = params;

  const tableQuery = crearTableQuery<RecaudoMensual, FiltrosRecaudoMensual>(
    params,
    COLUMNAS,
  );

  const svc = reporteriaService();

  // el catálogo va primero: las columnas de pendientes lo necesitan para
  // el filtro de moto, y crearTableQuery lee esas columnas
  const catalogoMotos = await catalogoService().buscarMotos({
    pagina: 1,
    porPagina: 50,
  });

  // Cola de desembolso: alcance NACIONAL (el financiero desembolsa para
  // todas las tiendas). Decisión/estado son criterio FIJO → columnas
  // ocultas y filtros forzados DESPUÉS del spread (la URL no los pisa).
  // Params de orden propios (penOrden/penDir): en esta página conviven
  // dos tablas y no deben pisarse.
  const COLUMNAS_PENDIENTES = columnasSolicitudes({
    conWizard: false,
    conVendedor: true,
    conDecision: false,
    conEstado: false,
    motos: catalogoMotos.items.map((m) => m.nombre),
    accionExtra: (s) => (
      <form action={desembolsarSolicitud}>
        <input type="hidden" name="solicitudId" value={s.solicitud_id} />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 border border-black px-3 py-1.5 font-headline text-xs font-bold transition-colors hover:bg-black hover:text-white"
        >
          <BanknoteArrowDown className="size-3.5" />
          Desembolsar
        </button>
      </form>
    ),
  });
  const tqPendientes = crearTableQuery<SolicitudReciente, FiltrosSolicitudes>(
    params,
    COLUMNAS_PENDIENTES,
    { paramOrden: "penOrden", paramDir: "penDir" },
  );

  const [resumen, porFranja, recaudo, pendientes] = await Promise.all([
    svc.resumenCartera(),
    svc.moraPorFranja(),
    svc.recaudoMensual({ query: params.recQuery, ...tableQuery }),
    svc.solicitudesPaginadas({
      query: params.desQuery,
      orden: tqPendientes.orden,
      direccion: tqPendientes.direccion,
      filtros: {
        ...tqPendientes.filtros,
        decision: "APROBADO",
        estado: "evaluada",
      },
      pagina: 1,
      porPagina: 20,
    }),
  ]);

  const franjas = ORDEN_FRANJAS.map(
    (f) =>
      porFranja.find((x) => x.franja_mora === f) ?? {
        franja_mora: f,
        creditos: 0,
        capital_pendiente_centavos: 0,
      },
  );
  const maxFranja = Math.max(...franjas.map((f) => f.capital_pendiente_centavos), 1);

  return (
    <div>
      <PageHeader
        titulo="Cartera y riesgo"
        descripcion="Salud de la cartera, mora por franjas y recaudo mensual."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="Créditos activos" valor={String(resumen?.creditos_activos ?? 0)} />
        <Kpi titulo="Saldo de cartera" valor={pesosCompacto(resumen?.cartera_total_centavos ?? 0)} />
        <Kpi
          titulo="Cartera vencida"
          valor={pesosCompacto(resumen?.cartera_vencida_centavos ?? 0)}
          acento="amber"
        />
        <Kpi
          titulo="ICV"
          valor={`${(Number(resumen?.icv ?? 0) * 100).toFixed(1)}%`}
          acento="primary"
          nota="Índice de cartera vencida"
        />
      </div>

      <Tarjeta className="mt-6 overflow-x-auto">
        {error && (
          <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No se pudo desembolsar: {error}
          </p>
        )}
        {desembolsada && (
          <p className="mb-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            Crédito desembolsado (solicitud #{desembolsada}): plan de cuotas
            generado y asiento contable en camino.
          </p>
        )}

        <TablaDatos
          titulo={
            // subtítulo en bloque (no inline): un título largo empujaba el
            // input de búsqueda a la línea de abajo — así queda enfrentado
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
          columnas={COLUMNAS_PENDIENTES}
          filas={pendientes.items}
          claveFila={(s) => s.solicitud_id}
          paramOrden="penOrden"
          paramDir="penDir"
          vacio="No hay solicitudes aprobadas esperando desembolso."
        />
      </Tarjeta>

      <Tarjeta className="mt-6">
        <h2 className="font-semibold">Mora por franjas (días)</h2>
        <div className="mt-4 space-y-3">
          {franjas.map((f) => (
            <BarraHorizontal
              key={f.franja_mora}
              etiqueta={f.franja_mora}
              valor={f.capital_pendiente_centavos}
              max={maxFranja}
              color={COLORES_FRANJAS[f.franja_mora]}
              detalle={`${pesosCompacto(f.capital_pendiente_centavos)} · ${f.creditos} créd.`}
            />
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className="mt-6 overflow-x-auto">
        <TablaDatos
          titulo="Recaudo por mes"
          busqueda={{
            param: "recQuery",
            placeholder: "Mes (2026-07), pagos o monto en pesos…",
          }}
          exportarHref={hrefConParams("/cartera/exportar-recaudo", params)}
          columnas={COLUMNAS}
          filas={recaudo}
          claveFila={(r) => r.mes}
          vacio="No hay registros de recaudo."
        />
      </Tarjeta>
    </div>
  );
}
