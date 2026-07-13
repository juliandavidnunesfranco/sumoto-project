// Contabilidad (contable): asientos reales generados por los eventos del core
// (desembolso, pago). Cero conciliación bancaria inventada — solo lo que existe.

import { reporteriaService } from "@/lib/core-server";
import { pesos } from "@/lib/format";
import { Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function ContabilidadPage() {
  const asientos = await reporteriaService().asientosRecientes(30);

  const totalDebito = asientos.reduce((s, a) => s + a.total_debito_centavos, 0);
  const despachados = asientos.filter((a) => a.despacho === "despachado").length;
  const fallidos = asientos.filter((a) => a.despacho === "fallido").length;

  return (
    <div>
      <PageHeader
        titulo="Contabilidad"
        descripcion="Asientos de partida doble generados automáticamente por los eventos de cartera."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="Asientos registrados" valor={String(asientos.length)} />
        <Kpi titulo="Movimiento total" valor={pesos(totalDebito)} acento="primary" />
        <Kpi titulo="Despachados a World Office" valor={String(despachados)} acento="emerald" />
        <Kpi titulo="Fallidos (pendientes reintento)" valor={String(fallidos)} acento="amber" />
      </div>

      <Tarjeta className="mt-6 overflow-x-auto">
        <h2 className="font-semibold">Últimos asientos</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Fecha</th>
              <th className="py-2 font-medium">Descripción</th>
              <th className="py-2 font-medium">Origen</th>
              <th className="py-2 text-right font-medium">Débito</th>
              <th className="py-2 text-right font-medium">Crédito</th>
              <th className="py-2 text-right font-medium">Despacho</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {asientos.map((a) => (
              <tr key={a.asiento_id} className="border-t border-border">
                <td className="py-2">{a.fecha}</td>
                <td className="py-2 text-muted-foreground">{a.descripcion}</td>
                <td className="py-2 text-xs text-muted-foreground">{a.evento_origen}</td>
                <td className="py-2 text-right">{pesos(a.total_debito_centavos)}</td>
                <td className="py-2 text-right">{pesos(a.total_credito_centavos)}</td>
                <td className="py-2 text-right">
                  <span
                    className={cn(
                      "text-xs",
                      a.despacho === "despachado"
                        ? "text-emerald-400"
                        : a.despacho === "fallido"
                          ? "text-destructive"
                          : "text-amber-400",
                    )}
                  >
                    {a.despacho}
                  </span>
                </td>
              </tr>
            ))}
            {asientos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted-foreground">
                  Sin asientos todavía — se generan al desembolsar créditos o registrar pagos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
