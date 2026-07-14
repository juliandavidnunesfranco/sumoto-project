// Resumen de tienda (manager) — fiel al prototipo v0 pero con datos REALES:
// KPIs de colocación y aprobación, gráfico de colocación mensual, desempeño
// por vendedor (vía creado_por) y solicitudes con búsqueda + filtro. Todo
// server component sobre fachadas del core.

import { obtenerSesion } from "@/lib/auth";
import { catalogoService, reporteriaService } from "@/lib/core-server";
import { diaSiguiente, pesos, pesosCompacto } from "@/lib/format";
import { ColumnasMensuales, Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaSolicitudes } from "@/components/shared/tabla-solicitudes";
import { InputBusqueda } from "@/components/shared/input-busqueda";
import { FiltrosSolicitudes } from "@/components/shared/filtros-solicitudes";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";

export const dynamic = "force-dynamic";

const MES_CORTO = new Intl.DateTimeFormat("es-CO", { month: "short" });

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    pagina?: string;
    porPagina?: string;
    solQuery?: string;
    decision?: string;
    estado?: string;
    moto?: string;
    vendedor?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const porPagina = [10, 20, 40, 50].includes(Number(params.porPagina))
    ? Number(params.porPagina)
    : 10;

  const sesion = await obtenerSesion();
  const svc = reporteriaService();

  // últimos 12 meses de colocación (el seed desembolsa 5-11 meses atrás)
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1)
    .toISOString()
    .slice(0, 10);

  // manager sin tienda asignada = estado anómalo: todo vacío, nunca nacional
  const [porTienda, desempeno, colocacion, { items: solicitudes, total }, catalogoMotos] =
    sesion?.tiendaId
      ? await Promise.all([
          svc.carteraPorTienda(),
          svc.desempenoVendedores(sesion.tiendaId),
          svc.colocacionDiaria(sesion.tiendaId, desde),
          svc.solicitudesPaginadas({
            tiendaId: sesion.tiendaId,
            query: params.solQuery,
            decision: params.decision,
            estado: params.estado,
            moto: params.moto,
            // filtro por columna Vendedor = creadoPor
            creadoPor: params.vendedor,
            desdeFecha: params.desde,
            hastaFecha: params.hasta ? diaSiguiente(params.hasta) : undefined,
            pagina,
            porPagina,
          }),
          catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }),
        ])
      : [[], [], [], { items: [], total: 0 }, { items: [], total: 0 }];

  const miTienda = porTienda.find((t) => t.tienda_id === sesion?.tiendaId);

  // agregación mensual de la serie diaria, con los 12 meses SIEMPRE presentes
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 11 + i, 1);
    return { clave: d.toISOString().slice(0, 7), etiqueta: MES_CORTO.format(d), valor: 0 };
  });
  for (const dia of colocacion) {
    const mes = meses.find((m) => dia.fecha.startsWith(m.clave));
    if (mes) mes.valor += dia.monto_centavos;
  }

  const totalSolicitudes = desempeno.reduce((a, v) => a + v.solicitudes, 0);
  const totalAprobadas = desempeno.reduce((a, v) => a + v.aprobadas, 0);
  const colocacionAnio = meses.reduce((a, m) => a + m.valor, 0);
  const tasa = totalSolicitudes > 0 ? Math.round((totalAprobadas / totalSolicitudes) * 100) : 0;

  function hrefPagina(destino: number): string {
    const qs = new URLSearchParams();
    for (const clave of ["solQuery", "decision", "estado", "moto", "vendedor", "desde", "hasta"] as const) {
      if (params[clave]) qs.set(clave, params[clave]!);
    }
    qs.set("porPagina", String(porPagina));
    qs.set("pagina", String(destino));
    return `/tienda?${qs.toString()}`;
  }

  return (
    <div>
      <PageHeader
        titulo="Resumen de tienda"
        descripcion={
          miTienda
            ? `${miTienda.tienda_nombre} · colocación, desempeño del equipo y solicitudes.`
            : "Colocación, desempeño del equipo y solicitudes."
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="Colocación · último año" valor={pesosCompacto(colocacionAnio)} acento="primary" />
        <Kpi titulo="Solicitudes" valor={String(totalSolicitudes)} />
        <Kpi titulo="Aprobadas" valor={String(totalAprobadas)} acento="emerald" />
        <Kpi titulo="Tasa de aprobación" valor={`${tasa}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="font-semibold font-headline text-3xl">Colocación mensual</h2>
          <div className="mt-6">
            <ColumnasMensuales
              datos={meses.map((m) => ({ etiqueta: m.etiqueta, valor: m.valor }))}
              formato={(v) => (v > 0 ? pesosCompacto(v) : "")}
            />
          </div>
        </Tarjeta>

        <Tarjeta className="overflow-x-auto">
          <h2 className="font-semibold font-headline text-3xl">Desempeño por vendedor</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="pb-3 pr-4 font-medium">Vendedor</th>
                <th className="pb-3 pr-4 text-right font-medium">Solicitudes</th>
                <th className="pb-3 pr-4 text-right font-medium">Aprobadas</th>
                <th className="pb-3 text-right font-medium">Colocación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {desempeno.map((v) => (
                <tr key={v.creado_por}>
                  <td className="py-3 pr-4 font-medium">{v.vendedor_nombre}</td>
                  <td className="py-3 pr-4 text-right">{v.solicitudes}</td>
                  <td className="py-3 pr-4 text-right">{v.aprobadas}</td>
                  <td className="py-3 text-right font-semibold">
                    {pesos(v.colocacion_centavos)}
                  </td>
                </tr>
              ))}
              {desempeno.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    Sin datos de desempeño todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Tarjeta>
      </div>

      <Tarjeta className="mt-6 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold font-headline text-3xl">Solicitudes de la tienda</h2>
          <InputBusqueda
            param="solQuery"
            placeholder="Cliente, cédula, moto, vendedor o #id…"
            limpiarParams={["pagina"]}
            className="w-64 sm:w-80"
          />
        </div>
        <div className="mt-3">
          <FiltrosSolicitudes
            motos={catalogoMotos.items.map((m) => m.nombre)}
            vendedores={desempeno.map((v) => ({ id: v.creado_por, nombre: v.vendedor_nombre }))}
          />
        </div>
        <div className="mt-4">
          <TablaSolicitudes solicitudes={solicitudes} conReasignar conVendedor />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <SelectorPorPagina param="porPagina" resetParam="pagina" />
          <Paginacion
            pagina={pagina}
            porPagina={porPagina}
            total={total}
            hrefPagina={hrefPagina}
            sustantivo={["solicitud", "solicitudes"]}
          />
        </div>
      </Tarjeta>
    </div>
  );
}
