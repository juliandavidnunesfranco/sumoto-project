// Dashboard de cartera (financiero): server component que consulta la
// fachada ReporteriaService del core — la app jamás toca la base directo.

import Link from "next/link";
import { notFound } from "next/navigation";
import { BanknoteArrowDown } from "lucide-react";
import type { FiltrosRecaudoMensual } from "@sumo/contracts";
import { obtenerSesion } from "@/lib/auth";
import { reporteriaService } from "@/lib/core-server";
import { pesos, pesosCompacto } from "@/lib/format";
import { BarraHorizontal, FilaKpis,
  Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaDatos, type ColumnaDatos } from "@/components/shared/tabla-datos";
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
  const sesion = await obtenerSesion();
  if (!sesion) notFound();

  const tableQuery = crearTableQuery<RecaudoMensual, FiltrosRecaudoMensual>(
    params,
    COLUMNAS,
  );

  const svc = reporteriaService();

  // La cola de desembolso vive en su propio apartado (/desembolsos): allí
  // se valida el expediente antes de desembolsar. Aquí solo se cuenta.
  const [resumen, porFranja, recaudo, pendientes] = await Promise.all([
    svc.resumenCartera(sesion.empresaId),
    svc.moraPorFranja(sesion.empresaId),
    svc.recaudoMensual(sesion.empresaId, { query: params.recQuery, ...tableQuery }),
    svc.solicitudesPaginadas(sesion.empresaId, {
      filtros: { decision: "APROBADO", estado: "evaluada" },
      pagina: 1,
      porPagina: 1,
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

      <FilaKpis>
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
      </FilaKpis>

      {pendientes.total > 0 && (
        <Link
          href="/desembolsos"
          className="mt-6 flex items-center justify-between border border-border bg-card p-4 transition-colors hover:border-black"
        >
          <span className="flex items-center gap-3">
            <BanknoteArrowDown className="size-5 text-primary" />
            <span>
              <span className="block font-headline text-lg font-bold tracking-tight">
                {pendientes.total} solicitud{pendientes.total === 1 ? "" : "es"} esperando
                desembolso
              </span>
              <span className="block text-xs text-muted-foreground">
                Verifica el expediente y desembolsa en el apartado Desembolsos.
              </span>
            </span>
          </span>
          <span className="font-headline text-sm font-bold">Ir a Desembolsos →</span>
        </Link>
      )}

      <Tarjeta className="mt-6">
        <h2 className="font-headline text-3xl font-bold tracking-tight">Mora por franjas (días)</h2>
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
