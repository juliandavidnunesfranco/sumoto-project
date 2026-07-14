// Calendario del manager — 100% SSR: grid mensual con la colocación REAL de
// cada día (reporteria) y las citas (agenda), totales por semana y por mes.
// El mes activo viaja en searchParams (?mes=YYYY-MM); "Nueva cita" es un
// formulario con server action contra la fachada del core.

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { agendaService, reporteriaService } from "@/lib/core-server";
import { pesosCompacto } from "@/lib/format";
import { Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { crearCita } from "./actions";

export const dynamic = "force-dynamic";

const MES_LARGO = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function claveDia(fecha: Date): string {
  // clave local yyyy-mm-dd (sin pasar por UTC, que corre el día)
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${m}-${d}`;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; error?: string }>;
}) {
  const params = await searchParams;
  const errores = params.error ? params.error.split("|") : [];

  const hoy = new Date();
  const [anio, mes] = /^\d{4}-\d{2}$/.test(params.mes ?? "")
    ? params.mes!.split("-").map(Number)
    : [hoy.getFullYear(), hoy.getMonth() + 1];

  const primerDia = new Date(anio, mes - 1, 1);
  const primerDiaSiguiente = new Date(anio, mes, 1);
  const mesAnterior = new Date(anio, mes - 2, 1);

  const sesion = await obtenerSesion();
  const [citas, colocacion] = sesion?.tiendaId
    ? await Promise.all([
        agendaService().citasEntre(
          sesion.tiendaId,
          primerDia.toISOString(),
          primerDiaSiguiente.toISOString(),
        ),
        reporteriaService().colocacionDiaria(
          sesion.tiendaId,
          claveDia(primerDia),
          claveDia(primerDiaSiguiente),
        ),
      ])
    : [[], []];

  // índices por día local
  const citasPorDia = new Map<string, typeof citas>();
  for (const c of citas) {
    const clave = claveDia(new Date(c.fechaHoraIso));
    citasPorDia.set(clave, [...(citasPorDia.get(clave) ?? []), c]);
  }
  const montoPorDia = new Map(colocacion.map((c) => [c.fecha, c.monto_centavos]));

  // grid: semanas de lunes a domingo, con null en celdas fuera del mes
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  const totalMes = colocacion.reduce((a, c) => a + c.monto_centavos, 0);
  const totalCreditos = colocacion.reduce((a, c) => a + c.creditos, 0);
  const claveHoy = claveDia(hoy);

  function hrefMes(destino: Date): string {
    return `/calendario?mes=${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, "0")}`;
  }

  function totalSemana(semana: (number | null)[]): number {
    return semana.reduce<number>((acc, dia) => {
      if (!dia) return acc;
      return acc + (montoPorDia.get(claveDia(new Date(anio, mes - 1, dia))) ?? 0);
    }, 0);
  }

  return (
    <div>
      <PageHeader
        titulo="Calendario"
        descripcion="Colocación diaria, totales semanales y citas agendadas de tu tienda."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="Colocación del mes" valor={pesosCompacto(totalMes)} acento="primary" />
        <Kpi titulo="Créditos desembolsados" valor={String(totalCreditos)} />
        <Kpi titulo="Citas del mes" valor={String(citas.length)} />
        <Kpi
          titulo="Visitas de clientes"
          valor={String(citas.filter((c) => c.tipo === "visita").length)}
          acento="emerald"
        />
      </div>

      {errores.length > 0 && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errores.map((e) => (
            <p key={e}>• {e}</p>
          ))}
        </div>
      )}

      <Tarjeta className="mt-6 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold font-headline text-3xl capitalize">
            {MES_LARGO.format(primerDia)}
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href={hrefMes(mesAnterior)}
              className="rounded-lg border border-input p-2 text-muted-foreground transition-colors duration-200 hover:border-primary hover:text-foreground"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <Link
              href={hrefMes(primerDiaSiguiente)}
              className="rounded-lg border border-input p-2 text-muted-foreground transition-colors duration-200 hover:border-primary hover:text-foreground"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        <table className="mt-4 w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              {DIAS_SEMANA.map((d) => (
                <th key={d} className="border border-border p-2 font-medium">
                  {d}
                </th>
              ))}
              <th className="border border-border bg-secondary p-2 font-medium text-right">
                Semana
              </th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((semana, i) => (
              <tr key={i}>
                {semana.map((dia, j) => {
                  const clave = dia ? claveDia(new Date(anio, mes - 1, dia)) : "";
                  const monto = dia ? montoPorDia.get(clave) : undefined;
                  const delDia = dia ? (citasPorDia.get(clave) ?? []) : [];
                  return (
                    <td
                      key={j}
                      className={cn(
                        "h-24 border border-border p-1.5 align-top",
                        !dia && "bg-secondary/40",
                        clave === claveHoy && "bg-primary/5",
                      )}
                    >
                      {dia ? (
                        <div className="flex h-full flex-col gap-1">
                          <span
                            className={cn(
                              "text-xs",
                              clave === claveHoy
                                ? "font-bold text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {dia}
                          </span>
                          {monto ? (
                            <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                              {pesosCompacto(monto)}
                            </span>
                          ) : null}
                          {delDia.map((c) => (
                            <span
                              key={c.id}
                              title={`${HORA.format(new Date(c.fechaHoraIso))} · ${c.titulo}`}
                              className={cn(
                                "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]",
                                c.tipo === "visita"
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-amber-500/10 text-amber-700",
                              )}
                            >
                              {c.tipo === "visita" ? (
                                <MapPin className="size-2.5 shrink-0" />
                              ) : (
                                <Users className="size-2.5 shrink-0" />
                              )}
                              <span className="truncate">{c.titulo}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
                <td className="border border-border bg-secondary p-2 text-right align-middle text-xs font-semibold tabular-nums">
                  {totalSemana(semana) > 0 ? pesosCompacto(totalSemana(semana)) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta className="mt-6">
        <h2 className="flex items-center gap-2 font-semibold font-headline text-3xl">
          <CalendarDays className="size-6" />
          Nueva cita
        </h2>
        <form action={crearCita} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm text-muted-foreground">
            Título
            <input
              name="titulo"
              required
              placeholder="Visita de cliente, reunión de equipo…"
              className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Tipo
            <select
              name="tipo"
              className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground"
            >
              <option value="reunion">Reunión</option>
              <option value="visita">Visita de cliente</option>
            </select>
          </label>
          <label className="text-sm text-muted-foreground">
            Cédula del cliente (opcional)
            <input
              name="clienteCedula"
              inputMode="numeric"
              placeholder="1000000008"
              className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 tabular-nums text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Fecha
            <input
              type="date"
              name="fecha"
              required
              defaultValue={claveDia(hoy)}
              className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Hora
            <input
              type="time"
              name="hora"
              required
              defaultValue="09:00"
              className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground"
            />
          </label>
          <label className="sm:col-span-2 text-sm text-muted-foreground">
            Notas (opcional)
            <input
              name="notas"
              placeholder="Trae pagaré firmado…"
              className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground outline-none focus:border-primary"
            />
          </label>
          <Button type="submit" className="sm:col-span-2" size="lg">
            Agendar cita
          </Button>
        </form>
      </Tarjeta>
    </div>
  );
}
