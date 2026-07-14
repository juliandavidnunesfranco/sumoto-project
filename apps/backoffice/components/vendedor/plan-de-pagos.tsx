// Tabla del plan de pagos — recibe las cuotas ya calculadas (page.tsx las
// genera una sola vez con generarPlanDePagos de @sumo/core, la MISMA función
// que cartera usará al desembolsar, para reutilizarlas también en el CSV de
// DescargasDocumento sin recalcular). Puro presentacional.

import type { Cuota } from "@sumo/core";
import { pesos } from "@/lib/format";

export function PlanDePagos({ cuotas }: { cuotas: Cuota[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Cuota</th>
            <th className="py-2 font-medium">Vence</th>
            <th className="py-2 text-right font-medium">Capital</th>
            <th className="py-2 text-right font-medium">Interés</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {cuotas.map((c) => (
            <tr key={c.numero} className="border-t border-border">
              <td className="py-2">{c.numero}</td>
              <td className="py-2 text-muted-foreground">{c.fechaVencimiento.slice(0, 10)}</td>
              <td className="py-2 text-right">{pesos(c.capitalCentavos)}</td>
              <td className="py-2 text-right">{pesos(c.interesCentavos)}</td>
              <td className="py-2 text-right font-medium">
                {pesos(c.capitalCentavos + c.interesCentavos)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
