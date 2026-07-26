// Resumen de tienda (manager) — fiel al prototipo v0 pero con datos REALES:
// KPIs de colocación y aprobación, gráfico de colocación mensual, desempeño
// por vendedor (vía creado_por) y solicitudes con búsqueda + filtro. Todo
// server component sobre fachadas del core.

import type { FiltrosSolicitudes } from "@sumo/contracts";
import type { SolicitudReciente } from "@sumo/core";
import { obtenerSesion } from "@/lib/auth";
import { catalogoService, reporteriaService } from "@/lib/core-server";
import { pesos, pesosCompacto } from "@/lib/format";
import {
  BarraHorizontal,
  ColumnasMensuales,
  FilaKpis,
  Kpi,
  PageHeader,
  Tarjeta,
} from "@/components/panel/ui";
import { TablaDatos } from "@/components/shared/tabla-datos";
import { columnasSolicitudes } from "@/components/shared/columnas-solicitudes";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";
import { crearTableQuery, hrefConParams } from "@/lib/tabla.query";

export const dynamic = "force-dynamic";

const MES_CORTO = new Intl.DateTimeFormat("es-CO", { month: "short" });

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
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

  // manager sin tienda asignada = estado anómalo: todo vacío, nunca nacional.
  // Primera tanda: lo que las COLUMNAS necesitan para sus filtros (motos del
  // catálogo, vendedores del desempeño); las solicitudes van después porque
  // crearTableQuery lee esas columnas.
  const [porTienda, desempeno, colocacion, catalogoMotos] = sesion?.tiendaId
    ? await Promise.all([
        svc.carteraPorTienda(sesion.empresaId),
        svc.desempenoVendedores(sesion.empresaId, sesion.tiendaId),
        svc.colocacionDiaria(sesion.empresaId, sesion.tiendaId, desde),
        catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }),
      ])
    : [[], [], [], { items: [], total: 0 }];

  const columnas = columnasSolicitudes({
    conReasignar: true,
    conVendedor: true,
    motos: catalogoMotos.items.map((m) => m.nombre),
    vendedores: desempeno.map((v) => ({ id: v.creado_por, nombre: v.vendedor_nombre })),
  });
  const tableQuery = crearTableQuery<SolicitudReciente, FiltrosSolicitudes>(
    params,
    columnas,
  );

  const { items: solicitudes, total } = sesion?.tiendaId
    ? await svc.solicitudesPaginadas(sesion.empresaId, {
        tiendaId: sesion.tiendaId,
        query: params.solQuery,
        ...tableQuery,
        pagina,
        porPagina,
      })
    : { items: [], total: 0 };

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

  // meta de colocación del mes corriente: el último de `meses` ES el mes
  // actual (la serie se construye hacia atrás desde hoy)
  const colocacionMes = meses[meses.length - 1]?.valor ?? 0;
  const meta = miTienda?.meta_colocacion_centavos ?? 0;
  const pctMeta = meta > 0 ? Math.round((colocacionMes / meta) * 100) : 0;

  function hrefPagina(destino: number): string {
    const qs = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor && clave !== "pagina") qs.set(clave, valor);
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

      <FilaKpis>
        <Kpi titulo="Colocación · último año" valor={pesosCompacto(colocacionAnio)} acento="primary" />
        <Kpi titulo="Solicitudes" valor={String(totalSolicitudes)} />
        <Kpi titulo="Aprobadas" valor={String(totalAprobadas)} acento="emerald" />
        <Kpi titulo="Tasa de aprobación" valor={`${tasa}%`} />
      </FilaKpis>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="font-semibold font-headline text-3xl">Colocación mensual</h2>
          {meta > 0 && (
            <div className="mt-4">
              <BarraHorizontal
                etiqueta={`Meta ${MES_CORTO.format(hoy)}`}
                valor={colocacionMes}
                max={meta}
                color={pctMeta >= 100 ? "bg-emerald-500" : "bg-primary"}
                detalle={`${pesosCompacto(colocacionMes)} de ${pesosCompacto(meta)} · ${pctMeta}%`}
              />
            </div>
          )}
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
        <TablaDatos
          titulo="Solicitudes de la tienda"
          busqueda={{
            param: "solQuery",
            placeholder: "Cliente, cédula, moto, vendedor o #id…",
          }}
          exportarHref={hrefConParams("/solicitudes/exportar", params)}
          columnas={columnas}
          filas={solicitudes}
          claveFila={(s) => s.solicitud_id}
        />
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
