// Vista general ejecutiva (ceo): mismos datos reales de reporteria, con
// franjas de mora nacional y ranking real de tiendas por cartera.

import { reporteriaService } from "@/lib/core-server";
import { pesosCompacto } from "@/lib/format";
import { BarraHorizontal, ColumnasMensuales, Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";

export const dynamic = "force-dynamic";

export default async function CeoPage() {
  const svc = reporteriaService();
  const [resumen, porTienda, recaudo] = await Promise.all([
    svc.resumenCartera(),
    svc.carteraPorTienda(),
    svc.recaudoMensual(),
  ]);

  const maxTienda = Math.max(...porTienda.map((t) => t.capital_total_centavos), 1);

  return (
    <div>
      <PageHeader
        titulo="Vista general"
        descripcion="Tablero ejecutivo del negocio de financiación. Solo lectura."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="Cartera total" valor={pesosCompacto(resumen?.cartera_total_centavos ?? 0)} acento="primary" />
        <Kpi titulo="Créditos activos" valor={String(resumen?.creditos_activos ?? 0)} />
        <Kpi
          titulo="Cartera vencida"
          valor={pesosCompacto(resumen?.cartera_vencida_centavos ?? 0)}
          acento="amber"
        />
        <Kpi titulo="ICV" valor={`${(Number(resumen?.icv ?? 0) * 100).toFixed(1)}%`} acento="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="font-semibold">Recaudo de los últimos meses</h2>
          <div className="mt-4">
            <ColumnasMensuales
              datos={recaudo
                .slice()
                .reverse()
                .map((r) => ({ etiqueta: r.mes.slice(0, 7), valor: r.recaudo_centavos }))}
              formato={(v) => pesosCompacto(v)}
            />
          </div>
        </Tarjeta>

        <Tarjeta>
          <h2 className="font-semibold">Cartera por tienda</h2>
          <div className="mt-4 space-y-3">
            {porTienda.map((t) => (
              <BarraHorizontal
                key={t.tienda_id}
                etiqueta={t.tienda_nombre.split(" ").slice(-1)[0]}
                valor={t.capital_total_centavos}
                max={maxTienda}
                detalle={`${pesosCompacto(t.capital_total_centavos)} · ${t.creditos_activos} créd.`}
              />
            ))}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
