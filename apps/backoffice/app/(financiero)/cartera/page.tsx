// Dashboard de cartera (financiero): server component que consulta la
// fachada ReporteriaService del core — la app jamás toca la base directo.

import { BanknoteArrowDown } from "lucide-react";
import { reporteriaService } from "@/lib/core-server";
import { pesos, pesosCompacto } from "@/lib/format";
import { BarraHorizontal, Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { desembolsarSolicitud } from "./actions";
import { TablaDatos, type ColumnaDatos } from "@/components/shared/tabla-datos";
import { PagoRegistrado } from "@sumo/core";

export const dynamic = "force-dynamic";

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

const ORDEN_FRANJAS = ["0-30", "31-60", "61-90", "90+"] as const;

const COLORES_FRANJAS: Record<string, string> = {
  "0-30": "bg-emerald-500",
  "31-60": "bg-amber-500",
  "61-90": "bg-orange-500",
  "90+": "bg-destructive",
};


const COLUMNAS: ColumnaDatos<PagoRegistrado >[]=[
  {
    titulo:"Mes",
    claveOrden: "Mes",
    render: (a)=>a.mes
  },
  {
    titulo: "Pagos",
    claveOrden: "pagos",
    filtro: {param: "Mayor", tipo: "opciones"},
    render: (a)=> a.pagos,
    alinear: "izquierda",
  },
  {
    titulo: "Capital",
    claveOrden: "capital",
    filtro: {param: "Mayor", tipo: "opciones"},
    render: (a)=> a.capital_centavos,
    clasesCelda: "bg-green-200/30 font-headline text-lg"
  },
  {
    titulo: "Intereses",
    claveOrden:"intereses",
    //filtro:{param: "Mayor", tipo: "opciones"},
    render: (a)=>a.intereses,

  },{
      titulo: "Mora",
      claveOrden: "mora",
      //filtro:{param: "Mayor", tipo: "opciones"},
      render: (a)=>a.mora,
  },
  {
    titulo: "Total",
    claveOrden: "total",
    //filtro: {param: "Mayor", tipo: "opciones"},
    render: (a)=> a.total,

  }
]







export default async function DashboardCartera({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; desembolsada?: string }>;
}) {
  const { error, desembolsada } = await searchParams;
  const svc = reporteriaService();
  const [resumen, porFranja, recaudo, pendientes] = await Promise.all([
    svc.resumenCartera(),
    svc.moraPorFranja(),
    svc.recaudoMensual(),
    // aprobadas por el motor que aún no son crédito — alcance NACIONAL:
    // el financiero desembolsa para todas las tiendas
    svc.solicitudesPaginadas({
      decision: "APROBADO",
      estado: "evaluada",
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            Pendientes de desembolso
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              aprobadas por el motor · todas las tiendas
            </span>
          </h2>
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No se pudo desembolsar: {error}
          </p>
        )}
        {desembolsada && (
          <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            Crédito desembolsado (solicitud #{desembolsada}): plan de cuotas
            generado y asiento contable en camino.
          </p>
        )}

        {pendientes.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No hay solicitudes aprobadas esperando desembolso.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Solicitud</th>
                <th className="py-2 pr-4 font-medium">Cliente</th>
                <th className="py-2 pr-4 font-medium">Moto</th>
                <th className="py-2 pr-4 text-right font-medium">Valor moto</th>
                <th className="py-2 pr-4 text-right font-medium">Cuota est.</th>
                <th className="py-2 pr-4 font-medium">Vendedor</th>
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {pendientes.items.map((s) => (
                <tr key={s.solicitud_id}>
                  <td className="py-2 pr-4 font-mono text-xs">#{s.solicitud_corta}</td>
                  <td className="py-2 pr-4">
                    <p className="font-medium">{s.cliente_nombre}</p>
                    <p className="text-xs text-muted-foreground">{s.cliente_cedula}</p>
                  </td>
                  <td className="py-2 pr-4">{s.moto_nombre}</td>
                  <td className="py-2 pr-4 text-right">{pesos(s.valor_moto_centavos)}</td>
                  <td className="py-2 pr-4 text-right">
                    {pesos(s.cuota_estimada_centavos ?? 0)}
                  </td>
                  <td className="py-2 pr-4">{s.vendedor_nombre}</td>
                  <td className="py-2 pr-4">{FECHA_CORTA.format(new Date(s.creado_en))}</td>
                  <td className="py-2 text-right">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
        <h2 className="font-semibold">Recaudo por mes</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Mes</th>
              <th className="py-2 text-right font-medium">Pagos</th>
              <th className="py-2 text-right font-medium">Capital</th>
              <th className="py-2 text-right font-medium">Interés</th>
              <th className="py-2 text-right font-medium">Mora</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {recaudo.map((r) => (
              <tr key={r.mes} className="border-t border-border">
                <td className="py-2">{r.mes.slice(0, 7)}</td>
                <td className="py-2 text-right">{r.pagos}</td>
                <td className="py-2 text-right">{pesos(r.capital_centavos)}</td>
                <td className="py-2 text-right text-emerald-400">{pesos(r.interes_centavos)}</td>
                <td className="py-2 text-right text-amber-400">{pesos(r.mora_centavos)}</td>
                <td className="py-2 text-right font-semibold">{pesos(r.recaudo_centavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta className="mt-6 overflow-x-auto">
        <h2 className="font-semibold">Recaudo por mes</h2>
          <div className="mt-4">
              <TablaDatos
              columnas={COLUMNAS}
              filas={recaudo}
              claveFila={(a)=>a.mes}
              vacio="xxxxxx"
              />
          </div>
        


      </Tarjeta>




    </div>
  );
}
