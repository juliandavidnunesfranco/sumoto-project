// "Hoy" del manager — el día de la tienda en una sola pantalla, 100% SSR:
// citas de la agenda de hoy, solicitudes creadas hoy y colocación del día.

import Link from "next/link";
import { CalendarDays, MapPin, TriangleAlert, Users } from "lucide-react";
import type { FiltrosSolicitudes } from "@sumo/contracts";
import type { SolicitudReciente } from "@sumo/core";
import { obtenerSesion } from "@/lib/auth";
import { agendaService, catalogoService, reporteriaService } from "@/lib/core-server";
import { diaSiguiente, pesosCompacto } from "@/lib/format";
import { FilaKpis,
  Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaDatos } from "@/components/shared/tabla-datos";
import { columnasSolicitudes } from "@/components/shared/columnas-solicitudes";
import { crearTableQuery } from "@/lib/tabla.query";

export const dynamic = "force-dynamic";

const HORA = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function claveDia(fecha: Date): string {
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${fecha.getFullYear()}-${m}-${String(fecha.getDate()).padStart(2, "0")}`;
}

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const sesion = await obtenerSesion();
  const hoy = new Date();
  const hoyIso = claveDia(hoy);
  const mananaIso = diaSiguiente(hoyIso);
  // límites del día LOCAL convertidos a instantes reales (la agenda guarda UTC)
  const inicioDia = new Date(`${hoyIso}T00:00:00`).toISOString();
  const finDia = new Date(`${mananaIso}T00:00:00`).toISOString();

  // Primera tanda: lo que las columnas necesitan para sus filtros (motos,
  // vendedores); las solicitudes van después (crearTableQuery lee columnas).
  const [citas, colocacion, desempeno, catalogoMotos, porTienda] = sesion?.tiendaId
    ? await Promise.all([
        agendaService().citasEntre(sesion.tiendaId, inicioDia, finDia),
        reporteriaService().colocacionDiaria(sesion.empresaId, sesion.tiendaId, hoyIso, mananaIso),
        reporteriaService().desempenoVendedores(sesion.empresaId, sesion.tiendaId),
        catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }),
        reporteriaService().carteraPorTienda(sesion.empresaId),
      ])
    : [[], [], [], { items: [], total: 0 }, []];

  // alerta de mora de LA tienda (backlog 2026-07-15): el manager abre su
  // día sabiendo cuánta cartera vencida carga la tienda
  const miTienda = porTienda.find((t) => t.tienda_id === sesion?.tiendaId);
  const vencido = miTienda?.capital_vencido_centavos ?? 0;
  const pctVencido =
    miTienda && miTienda.capital_total_centavos > 0
      ? Math.round((vencido / miTienda.capital_total_centavos) * 100)
      : 0;

  // el período es fijo (HOY): los encabezados solo narran orden y filtros
  // de columna, jamás mueven el día — por eso conFiltroFechas apagado y el
  // rango viaja como ALCANCE (desdeFecha/hastaFecha). Límites como INSTANTES
  // (no fecha plana): creado_en es timestamptz y una solicitud de las
  // 8 p. m. ya cae en "mañana" UTC — se perdía de la tabla.
  const columnas = columnasSolicitudes({
    conReasignar: true,
    conVendedor: true,
    conFiltroFechas: false,
    motos: catalogoMotos.items.map((m) => m.nombre),
    vendedores: desempeno.map((v) => ({ id: v.creado_por, nombre: v.vendedor_nombre })),
  });
  const tableQuery = crearTableQuery<SolicitudReciente, FiltrosSolicitudes>(
    params,
    columnas,
  );

  const { items: solicitudes, total } = sesion?.tiendaId
    ? await reporteriaService().solicitudesPaginadas(sesion.empresaId, {
        tiendaId: sesion.tiendaId,
        desdeFecha: inicioDia,
        hastaFecha: finDia,
        query: params.solQuery,
        ...tableQuery,
        pagina: 1,
        porPagina: 20,
      })
    : { items: [], total: 0 };

  const colocacionHoy = colocacion.reduce((a, c) => a + c.monto_centavos, 0);
  const aprobadasHoy = solicitudes.filter((s) => s.decision_resultado === "APROBADO").length;

  return (
    <div>
      <PageHeader
        titulo="Hoy"
        descripcion={`${FECHA_LARGA.format(hoy)} · lo que está pasando en tu tienda.`}
      />

      {vencido > 0 && (
        <p className="mb-4 flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          <TriangleAlert className="size-4 shrink-0" />
          <span>
            Tu tienda carga{" "}
            <strong className="tabular-nums">{pesosCompacto(vencido)}</strong> en
            cartera vencida ({pctVencido}% del saldo) — prioriza la gestión de
            cobro de hoy.
          </span>
        </p>
      )}

      <FilaKpis>
        <Kpi titulo="Solicitudes de hoy" valor={String(total)} acento="primary" />
        <Kpi titulo="Aprobadas hoy" valor={String(aprobadasHoy)} acento="emerald" />
        <Kpi titulo="Colocación de hoy" valor={pesosCompacto(colocacionHoy)} />
        <Kpi titulo="Citas de hoy" valor={String(citas.length)} />
      </FilaKpis>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <Tarjeta>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold font-headline text-3xl">Agenda de hoy</h2>
            <Link
              href="/calendario"
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <CalendarDays className="size-4" />
              Calendario
            </Link>
          </div>
          {citas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin citas para hoy.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {citas.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-3">
                  <span className="w-20 shrink-0 text-sm font-semibold tabular-nums">
                    {HORA.format(new Date(c.fechaHoraIso))}
                  </span>
                  <span
                    className={
                      c.tipo === "visita"
                        ? "mt-0.5 shrink-0 text-emerald-600"
                        : "mt-0.5 shrink-0 text-amber-600"
                    }
                  >
                    {c.tipo === "visita" ? <MapPin className="size-4" /> : <Users className="size-4" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{c.titulo}</span>
                    {c.clienteCedula ? (
                      <Link
                        href={`/clientes/${c.clienteCedula}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Ver casos del cliente →
                      </Link>
                    ) : null}
                    {c.notas ? (
                      <span className="block text-xs text-muted-foreground">{c.notas}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta className="overflow-x-auto">
          <TablaDatos
            titulo="Solicitudes de hoy"
            busqueda={{ param: "solQuery", placeholder: "Cliente, moto o #id…" }}
            columnas={columnas}
            filas={solicitudes}
            claveFila={(s) => s.solicitud_id}
            vacio="Sin solicitudes hoy (todavía)."
          />
        </Tarjeta>
      </div>
    </div>
  );
}
