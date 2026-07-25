// Vista general ejecutiva (ceo): mismos datos reales de reporteria, con
// recaudo mensual y ranking de tiendas por cartera en TablaDatos (orden,
// filtros por columna y búsqueda — mismo formato que el resto de tablas).

import type { CarteraPorTienda } from "@sumo/core";
import type { FiltrosCarteraTienda } from "@sumo/contracts";
import { reporteriaService } from "@/lib/core-server";
import { pesos, pesosCompacto } from "@/lib/format";
import { ColumnasMensuales, FilaKpis,
  Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaDatos, type ColumnaDatos } from "@/components/shared/tabla-datos";
import { crearTableQuery } from "@/lib/tabla.query";

export const dynamic = "force-dynamic";

const COLUMNAS_TIENDAS: ColumnaDatos<CarteraPorTienda>[] = [
  {
    titulo: "Tienda",
    claveOrden: "tienda_nombre",
    filtro: { param: "tienda", tipo: "texto", placeholder: "Nombre…" },
    render: (t) => <span className="font-medium">{t.tienda_nombre}</span>,
  },
  {
    titulo: "Créditos",
    claveOrden: "creditos_activos",
    filtro: { param: "creditos", tipo: "numero", placeholder: "Cantidad…" },
    alinear: "derecha",
    render: (t) => <span className="tabular-nums">{t.creditos_activos}</span>,
  },
  {
    titulo: "Cartera",
    claveOrden: "capital_total_centavos",
    filtro: { param: "capital", tipo: "numero", factor: 100, placeholder: "Pesos…" },
    alinear: "derecha",
    render: (t) => (
      <span className="tabular-nums font-semibold">
        {pesos(t.capital_total_centavos)}
      </span>
    ),
  },
  {
    titulo: "Vencida",
    claveOrden: "capital_vencido_centavos",
    filtro: { param: "vencido", tipo: "numero", factor: 100, placeholder: "Pesos…" },
    alinear: "derecha",
    render: (t) => (
      <span className="tabular-nums text-amber-500">
        {pesos(t.capital_vencido_centavos)}
      </span>
    ),
  },
];

export default async function CeoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const tableQuery = crearTableQuery<CarteraPorTienda, FiltrosCarteraTienda>(
    params,
    COLUMNAS_TIENDAS,
  );

  const svc = reporteriaService();
  const [resumen, porTienda, recaudo] = await Promise.all([
    svc.resumenCartera(),
    svc.carteraPorTienda({ query: params.tiendaQuery, ...tableQuery }),
    svc.recaudoMensual(),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Vista general"
        descripcion="Tablero ejecutivo del negocio de financiación. Solo lectura."
      />

      <FilaKpis>
        <Kpi titulo="Cartera total" valor={pesosCompacto(resumen?.cartera_total_centavos ?? 0)} acento="primary" />
        <Kpi titulo="Créditos activos" valor={String(resumen?.creditos_activos ?? 0)} />
        <Kpi
          titulo="Cartera vencida"
          valor={pesosCompacto(resumen?.cartera_vencida_centavos ?? 0)}
          acento="amber"
        />
        <Kpi titulo="ICV" valor={`${(Number(resumen?.icv ?? 0) * 100).toFixed(1)}%`} acento="amber" />
      </FilaKpis>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="font-headline text-3xl font-bold tracking-tight">Recaudo de los últimos meses</h2>
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

        <Tarjeta className="overflow-x-auto">
          <TablaDatos
            titulo="Cartera por tienda"
            busqueda={{ param: "tiendaQuery", placeholder: "Tienda o monto…" }}
            columnas={COLUMNAS_TIENDAS}
            filas={porTienda}
            claveFila={(t) => t.tienda_id}
            vacio="Sin tiendas con cartera todavía."
          />
        </Tarjeta>
      </div>
    </div>
  );
}
