// Expediente de crédito pre-desembolso (etapa de otorgamiento, SARC): el
// financiero valida la información del caso, archiva/descarga soportes y
// completa el checklist de verificación. El botón de desembolso se habilita
// con el expediente completo — y el core lo RE-VALIDA (dos puertas).

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BanknoteArrowDown,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  IdCard,
  Paperclip,
  XCircle,
} from "lucide-react";
import {
  catalogoService,
  clientesService,
  originacionService,
} from "@/lib/core-server";
import { obtenerSesion } from "@/lib/auth";
import { pesos } from "@/lib/format";
import { EstadoBadge, FilaKpis, Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  desembolsarSolicitud,
  guardarVerificacion,
  subirDocumentoExpediente,
} from "../actions";

export const dynamic = "force-dynamic";

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function tamanoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default async function ExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ solicitudId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string; docSubido?: string }>;
}) {
  const { solicitudId } = await params;
  const avisos = await searchParams;

  const sesion = await obtenerSesion();
  if (!sesion) notFound();

  const par = await originacionService().solicitudEvaluada(solicitudId);
  if (!par) notFound();

  const [verificacion, documentos, cliente, moto, producto] = await Promise.all([
    originacionService().verificacionDe(solicitudId),
    originacionService().listarDocumentos(solicitudId),
    clientesService().buscarPorId(par.solicitud.clienteId, sesion.empresaId),
    catalogoService().buscarMotoPorId(par.solicitud.motoId),
    originacionService().buscarProducto(par.solicitud.productoId),
  ]);

  const { solicitud, decision } = par;
  const { items, estado } = verificacion;
  const desembolsable =
    decision.resultado === "APROBADO" && solicitud.estado === "evaluada" && estado.completa;
  const montoAFinanciar =
    solicitud.valorMotoCentavos -
    solicitud.cuotaInicialCentavos +
    (solicitud.cargosAdicionalesCentavos ?? 0);

  return (
    <div>
      <Link
        href="/desembolsos"
        className="mb-4 inline-flex items-center gap-1.5 border border-transparent p-1 font-headline text-sm font-bold transition-colors duration-200 hover:border-black"
      >
        <ArrowLeft className="size-4" /> Desembolsos
      </Link>

      <PageHeader
        titulo={`Expediente #${solicitudId.slice(0, 8)}`}
        descripcion="Valida la información, archiva los soportes y completa la verificación antes de desembolsar."
        accion={<EstadoBadge estado={decision.resultado} />}
      />

      {avisos.error && (
        <p className="mb-4 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {avisos.error}
        </p>
      )}
      {avisos.guardado && (
        <p className="mb-4 flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" /> Verificación guardada.
        </p>
      )}
      {avisos.docSubido && (
        <p className="mb-4 flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" /> Documento archivado en el expediente.
        </p>
      )}

      {/* Datos del caso — mismo lenguaje del home: línea vertical + headline */}
      <FilaKpis className="mb-8">
        <Kpi
          titulo="Solicitante"
          valor={cliente ? `${cliente.nombres} ${cliente.apellidos}` : "—"}
          nota={cliente ? `CC ${cliente.cedula} · ${cliente.ciudad ?? "—"}` : undefined}
        />
        <Kpi
          titulo="Moto"
          valor={moto?.nombre ?? "—"}
          nota={producto ? `${producto.nombre} · ${(producto.tasaEA * 100).toFixed(1)}% EA` : undefined}
        />
        <Kpi
          titulo="Monto a financiar"
          valor={pesos(montoAFinanciar)}
          nota={`${solicitud.plazoMeses} meses · cuota est. ${pesos(decision.cuotaEstimadaCentavos)}`}
          acento="primary"
        />
        <Kpi
          titulo="Score de buró"
          valor={String(decision.score)}
          acento={decision.score >= 700 ? "emerald" : "amber"}
          nota={`ingresos ${pesos(solicitud.ingresosDeclaradosCentavos)}`}
        />
      </FilaKpis>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Checklist de verificación */}
        <Tarjeta>
          <h2 className="font-headline text-3xl font-bold tracking-tight">
            Verificación del expediente
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Los ítems obligatorios bloquean el desembolso; los demás suman al
            índice de completitud (mínimo {estado.puntajeMinimo} de{" "}
            {estado.puntajeMaximo} puntos).
          </p>

          <form action={guardarVerificacion} className="mt-5 space-y-3">
            <input type="hidden" name="solicitudId" value={solicitudId} />
            {items.map((item) => (
              <label
                key={item.codigo}
                className="flex cursor-pointer items-start justify-between gap-4 border border-border p-4 transition-colors hover:border-black"
              >
                <span className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="item"
                    value={item.codigo}
                    defaultChecked={item.marcado}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {item.etiqueta}
                      {item.obligatorio ? (
                        <span className="border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                          Obligatorio
                        </span>
                      ) : (
                        <span className="border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {item.puntos} pts
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.descripcion}
                    </span>
                    {item.marcado && item.marcadoEn ? (
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        verificado el {FECHA_CORTA.format(new Date(item.marcadoEn))}
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
            ))}
            <Button type="submit" className="w-full">
              Guardar verificación
            </Button>
          </form>
        </Tarjeta>

        <div className="space-y-6">
          {/* Estado + desembolso */}
          <Tarjeta>
            <h3 className="font-headline text-lg font-bold tracking-tight">
              Estado del expediente
            </h3>
            <div className="mt-3 flex items-end justify-between">
              <p
                className={cn(
                  "font-headline text-4xl font-bold tabular-nums tracking-tight",
                  estado.completa ? "text-emerald-500" : "text-amber-500",
                )}
              >
                {estado.puntaje}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / {estado.puntajeMaximo} pts
                </span>
              </p>
              {estado.completa ? (
                <CheckCircle2 className="size-6 text-emerald-500" />
              ) : (
                <XCircle className="size-6 text-amber-500" />
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full",
                  estado.completa ? "bg-emerald-500" : "bg-amber-500",
                )}
                style={{
                  width: `${Math.min(100, Math.round((estado.puntaje / estado.puntajeMaximo) * 100))}%`,
                }}
              />
            </div>
            <ul className="mt-4 space-y-1.5">
              {estado.razones.map((r) => (
                <li key={r} className="flex items-start gap-1.5 text-xs">
                  {r.startsWith("falta") ? (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  )}
                  <span className="text-muted-foreground">{r}</span>
                </li>
              ))}
            </ul>

            <form action={desembolsarSolicitud} className="mt-5">
              <input type="hidden" name="solicitudId" value={solicitudId} />
              <Button type="submit" className="w-full" disabled={!desembolsable}>
                <BanknoteArrowDown className="mr-1.5 size-4" />
                {solicitud.estado === "desembolsada"
                  ? "Ya desembolsada"
                  : "Desembolsar crédito"}
              </Button>
              {!desembolsable && solicitud.estado === "evaluada" ? (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Se habilita con el expediente completo — y el core lo vuelve a
                  validar al desembolsar.
                </p>
              ) : null}
            </form>
          </Tarjeta>

          {/* Decisión del motor */}
          <Tarjeta>
            <h3 className="font-headline text-lg font-bold tracking-tight">
              Decisión del motor
            </h3>
            <ul className="mt-3 space-y-1.5">
              {decision.razones.map((r) => (
                <li key={r} className="flex items-start gap-1.5 text-xs">
                  {decision.resultado === "NEGADO" ? (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  )}
                  <span className="text-muted-foreground">{r}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>

          {/* Soportes del expediente */}
          <Tarjeta>
            <h3 className="font-headline text-lg font-bold tracking-tight">
              Soportes del expediente
            </h3>
            <div className="mt-3 space-y-2">
              <a
                href={`/desembolsos/${solicitudId}/buro`}
                className="flex items-center justify-between border border-border px-3 py-2 text-sm transition-colors hover:border-black"
              >
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" /> Reporte de buró
                  archivado
                </span>
                <Download className="size-4 text-muted-foreground" />
              </a>
              <a
                href={`/desembolsos/${solicitudId}/identidad`}
                className="flex items-center justify-between border border-border px-3 py-2 text-sm transition-colors hover:border-black"
              >
                <span className="flex items-center gap-2">
                  <IdCard className="size-4 text-primary" /> Documento de
                  identidad (datos)
                </span>
                <Download className="size-4 text-muted-foreground" />
              </a>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Documentos del solicitante
            </p>
            {documentos.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Sin documentos cargados todavía.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {documentos.map((d) => (
                  <li key={d.nombre}>
                    <a
                      href={`/desembolsos/${solicitudId}/documentos/${encodeURIComponent(d.nombre)}`}
                      className="flex items-center justify-between border border-border px-3 py-2 text-sm transition-colors hover:border-black"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileCheck className="size-4 shrink-0 text-emerald-500" />
                        <span className="truncate">{d.nombre}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {tamanoLegible(d.tamanoBytes)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <form action={subirDocumentoExpediente} className="mt-3">
              <input type="hidden" name="solicitudId" value={solicitudId} />
              <label className="flex cursor-pointer items-center gap-2 border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary">
                <Paperclip className="size-4" />
                Adjuntar documento (PDF, PNG, JPG · máx 5 MB)
                <input
                  type="file"
                  name="archivo"
                  accept="application/pdf,image/png,image/jpeg"
                  required
                  className="sr-only"
                />
              </label>
              <Button type="submit" variant="secondary" size="sm" className="mt-2 w-full">
                Subir al expediente
              </Button>
            </form>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
