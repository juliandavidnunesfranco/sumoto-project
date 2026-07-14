// "Hoy" del manager — el día de la tienda en una sola pantalla, 100% SSR:
// citas de la agenda de hoy, solicitudes creadas hoy y colocación del día.

import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { agendaService, reporteriaService } from "@/lib/core-server";
import { diaSiguiente, pesosCompacto } from "@/lib/format";
import { Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { TablaSolicitudes } from "@/components/shared/tabla-solicitudes";

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

export default async function HoyPage() {
  const sesion = await obtenerSesion();
  const hoy = new Date();
  const hoyIso = claveDia(hoy);
  const mananaIso = diaSiguiente(hoyIso);
  // límites del día LOCAL convertidos a instantes reales (la agenda guarda UTC)
  const inicioDia = new Date(`${hoyIso}T00:00:00`).toISOString();
  const finDia = new Date(`${mananaIso}T00:00:00`).toISOString();

  const [citas, colocacion, { items: solicitudes, total }] = sesion?.tiendaId
    ? await Promise.all([
        agendaService().citasEntre(sesion.tiendaId, inicioDia, finDia),
        reporteriaService().colocacionDiaria(sesion.tiendaId, hoyIso, mananaIso),
        reporteriaService().solicitudesPaginadas({
          tiendaId: sesion.tiendaId,
          desdeFecha: hoyIso,
          hastaFecha: mananaIso,
          pagina: 1,
          porPagina: 20,
        }),
      ])
    : [[], [], { items: [], total: 0 }];

  const colocacionHoy = colocacion.reduce((a, c) => a + c.monto_centavos, 0);
  const aprobadasHoy = solicitudes.filter((s) => s.decision_resultado === "APROBADO").length;

  return (
    <div>
      <PageHeader
        titulo="Hoy"
        descripcion={`${FECHA_LARGA.format(hoy)} · lo que está pasando en tu tienda.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="Solicitudes de hoy" valor={String(total)} acento="primary" />
        <Kpi titulo="Aprobadas hoy" valor={String(aprobadasHoy)} acento="emerald" />
        <Kpi titulo="Colocación de hoy" valor={pesosCompacto(colocacionHoy)} />
        <Kpi titulo="Citas de hoy" valor={String(citas.length)} />
      </div>

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
          <h2 className="font-semibold font-headline text-3xl">Solicitudes de hoy</h2>
          <div className="mt-4">
            <TablaSolicitudes solicitudes={solicitudes} conReasignar conVendedor />
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
