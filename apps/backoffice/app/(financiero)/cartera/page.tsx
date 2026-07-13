// Dashboard de cartera (financiero/ceo): server component que consulta la
// fachada ReporteriaService del core — la app jamás toca la base directo.

import { reporteriaService } from "@/lib/core-server";
import { pesos } from "@/lib/format";

export const dynamic = "force-dynamic";

const ORDEN_FRANJAS = ["0-30", "31-60", "61-90", "90+"] as const;
const COLORES_FRANJAS: Record<string, string> = {
  "0-30": "bg-emerald-500",
  "31-60": "bg-amber-500",
  "61-90": "bg-orange-500",
  "90+": "bg-red-600",
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
  const maxFranja = Math.max(
    ...franjas.map((f) => f.capital_pendiente_centavos),
    1,
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-black">
          SU<span className="text-red-500">MOTO</span>{" "}
          <span className="font-normal text-zinc-400">· Cartera</span>
        </h1>

        {/* Tarjetas resumen */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Tarjeta
            titulo="Créditos activos"
            valor={String(resumen?.creditos_activos ?? 0)}
          />
          <Tarjeta
            titulo="Saldo de cartera"
            valor={pesos(resumen?.cartera_total_centavos ?? 0)}
          />
          <Tarjeta
            titulo="Cartera vencida"
            valor={pesos(resumen?.cartera_vencida_centavos ?? 0)}
            acento="text-amber-400"
          />
          <Tarjeta
            titulo="ICV"
            valor={`${(Number(resumen?.icv ?? 0) * 100).toFixed(1)}%`}
            acento="text-red-400"
          />
        </div>

        {/* Mora por franjas */}
        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold text-zinc-200">Mora por franjas (días)</h2>
          <div className="mt-4 space-y-3">
            {franjas.map((f) => (
              <div key={f.franja_mora} className="flex items-center gap-3">
                <span className="w-14 text-sm text-zinc-400">{f.franja_mora}</span>
                <div className="h-6 flex-1 rounded bg-zinc-800">
                  <div
                    className={`h-6 rounded ${COLORES_FRANJAS[f.franja_mora]}`}
                    style={{
                      width: `${Math.round((f.capital_pendiente_centavos / maxFranja) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-36 text-right text-sm tabular-nums">
                  {pesos(f.capital_pendiente_centavos)}
                </span>
                <span className="w-20 text-right text-xs text-zinc-500">
                  {f.creditos} créd.
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Recaudo mensual */}
        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold text-zinc-200">Recaudo por mes</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2">Mes</th>
                  <th className="text-right">Pagos</th>
                  <th className="text-right">Capital</th>
                  <th className="text-right">Interés</th>
                  <th className="text-right">Mora</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {recaudo.map((r) => (
                  <tr key={r.mes} className="border-t border-zinc-800">
                    <td className="py-2">{r.mes.slice(0, 7)}</td>
                    <td className="text-right">{r.pagos}</td>
                    <td className="text-right">{pesos(r.capital_centavos)}</td>
                    <td className="text-right">{pesos(r.interes_centavos)}</td>
                    <td className="text-right">{pesos(r.mora_centavos)}</td>
                    <td className="text-right font-semibold">
                      {pesos(r.recaudo_centavos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Tarjeta({
  titulo,
  valor,
  acento = "text-white",
}: {
  titulo: string;
  valor: string;
  acento?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className={`mt-1 text-xl font-bold ${acento}`}>{valor}</p>
    </div>
  );
}
