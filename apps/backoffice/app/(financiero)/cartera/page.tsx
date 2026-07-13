// Dashboard de cartera (financiero): server component que consulta la
// fachada ReporteriaService del core — la app jamás toca la base directo.

import { reporteriaService } from "@/lib/core-server";
import { pesos, pesosCompacto } from "@/lib/format";
import { BarraHorizontal, Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";

export const dynamic = "force-dynamic";

const ORDEN_FRANJAS = ["0-30", "31-60", "61-90", "90+"] as const;
const COLORES_FRANJAS: Record<string, string> = {
  "0-30": "bg-emerald-500",
  "31-60": "bg-amber-500",
  "61-90": "bg-orange-500",
  "90+": "bg-destructive",
};

export default async function DashboardCartera() {
  const svc = reporteriaService();
  const [resumen, porFranja, recaudo] = await Promise.all([
    svc.resumenCartera(),
    svc.moraPorFranja(),
    svc.recaudoMensual(),
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
    </div>
  );
}
