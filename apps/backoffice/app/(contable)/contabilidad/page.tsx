// Contabilidad (contable): asientos reales generados por los eventos del core
// (desembolso, pago). Cero conciliación bancaria inventada — solo lo que existe.
// Tabla sobre TablaDatos: orden y filtros en cada encabezado (mismo formato
// que el resto de tablas del backoffice), narrados por searchParams.

import { reporteriaService } from "@/lib/core-server";
import type { AsientoReciente } from "@sumo/core";
import { pesos } from "@/lib/format";
import { Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaDatos, type ColumnaDatos } from "@/components/shared/tabla-datos";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const OPCIONES_ORIGEN = [
  { valor: "cartera.credito.desembolsado", etiqueta: "Desembolso" },
  { valor: "cartera.pago.registrado", etiqueta: "Pago" },
];

const OPCIONES_DESPACHO = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "despachado", etiqueta: "Despachado" },
  { valor: "fallido", etiqueta: "Fallido" },
];

const COLUMNAS: ColumnaDatos<AsientoReciente>[] = [
  {
    titulo: "Fecha",
    claveOrden: "fecha",
    filtro: { param: "desde", tipo: "rango-fechas" },
    render: (a) => a.fecha,
  },
  {
    titulo: "Descripción",
    claveOrden: "descripcion",
    render: (a) => <span className="text-muted-foreground">{a.descripcion}</span>,
  },
  {
    titulo: "Origen",
    claveOrden: "evento_origen",
    filtro: { param: "origen", tipo: "opciones", opciones: OPCIONES_ORIGEN },
    render: (a) => (
      <span className="text-xs text-muted-foreground">{a.evento_origen}</span>
    ),
  },
  {
    titulo: "Débito",
    claveOrden: "total_debito_centavos",
    alinear: "derecha",
    render: (a) => <span className="tabular-nums">{pesos(a.total_debito_centavos)}</span>,
  },
  {
    titulo: "Crédito",
    claveOrden: "total_credito_centavos",
    alinear: "derecha",
    render: (a) => <span className="tabular-nums">{pesos(a.total_credito_centavos)}</span>,
  },
  {
    titulo: "Despacho",
    claveOrden: "despacho",
    filtro: { param: "despacho", tipo: "opciones", opciones: OPCIONES_DESPACHO },
    alinear: "derecha",
    render: (a) => (
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
    ),
  },
];

export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{
    origen?: string;
    despacho?: string;
    desde?: string;
    hasta?: string;
    orden?: string;
    dir?: string;
  }>;
}) {
  const params = await searchParams;
  const asientos = await reporteriaService().asientosRecientes({
    eventoOrigen: params.origen,
    despacho: params.despacho,
    desdeFecha: params.desde,
    hastaFecha: params.hasta,
    orden: params.orden,
    direccion: params.dir === "asc" ? "asc" : "desc",
    limite: 30,
  });

  // los KPIs siguen al filtro: describen lo que la tabla muestra
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
        <div className="mt-4">
          <TablaDatos
            columnas={COLUMNAS}
            filas={asientos}
            claveFila={(a) => a.asiento_id}
            vacio="Sin asientos todavía — se generan al desembolsar créditos o registrar pagos."
          />
        </div>
      </Tarjeta>
    </div>
  );
}
