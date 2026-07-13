// Flujo estrella del vendedor — 100% SSR (server component + server actions).
// El paso del wizard vive en searchParams. CERO lógica de negocio: todo lo
// deciden las fachadas del core.

import { CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { clientesService, originacionService } from "@/lib/core-server";
import { pesos } from "@/lib/format";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { GaugeScore } from "@/components/vendedor/gauge-score";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { escanearCedula, evaluarSolicitud } from "./actions";

export const dynamic = "force-dynamic";

const PLAZOS = [12, 24, 36, 48];

const ESTILOS_RESULTADO: Record<string, string> = {
  APROBADO: "border-emerald-500/50 bg-emerald-500/10",
  NEGADO: "border-destructive/50 bg-destructive/10",
  REVISION_MANUAL: "border-amber-500/50 bg-amber-500/10",
};
const COLOR_TITULO: Record<string, string> = {
  APROBADO: "text-emerald-400",
  NEGADO: "text-destructive",
  REVISION_MANUAL: "text-amber-400",
};
const TITULOS: Record<string, string> = {
  APROBADO: "Aprobado",
  NEGADO: "Negado",
  REVISION_MANUAL: "Revisión manual",
};

function Paso({ n, activo }: { n: number; activo?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        activo ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

export default async function NuevaSolicitud({
  searchParams,
}: {
  searchParams: Promise<{ cedula?: string; solicitudId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const errores = params.error ? params.error.split("|") : [];

  const cliente = params.cedula ? await clientesService().buscarPorCedula(params.cedula) : null;
  const productos = cliente ? await originacionService().listarProductosActivos() : [];
  const evaluada = params.solicitudId
    ? await originacionService().solicitudEvaluada(params.solicitudId)
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titulo="Nueva solicitud de crédito"
        descripcion="Escanea la cédula, arma el crédito y obtén la decisión en minutos."
      />

      {/* Paso 1 · Cliente */}
      {!evaluada && (
        <Tarjeta>
          <div className="flex items-center gap-2">
            <Paso n={1} activo />
            <h2 className="font-semibold">Escanear cédula del solicitante</h2>
          </div>
          <form action={escanearCedula} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              name="cedula"
              required
              minLength={6}
              defaultValue={params.cedula ?? ""}
              placeholder="Número de cédula"
              inputMode="numeric"
              className="flex-1 rounded-lg border border-input bg-secondary px-3 py-2.5 outline-none focus:border-primary"
            />
            <Button type="submit">
              <ScanLine className="size-4" />
              Escanear cédula
            </Button>
          </form>
          {cliente ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="size-4" />
              {cliente.nombres} {cliente.apellidos} — CC {cliente.cedula}
              {cliente.ciudad ? ` · ${cliente.ciudad}` : ""}
            </p>
          ) : null}
        </Tarjeta>
      )}

      {/* Paso 2 · Crédito */}
      {cliente && !evaluada && (
        <Tarjeta className="mt-6">
          <div className="flex items-center gap-2">
            <Paso n={2} activo />
            <h2 className="font-semibold">Armar el crédito</h2>
          </div>
          <form action={evaluarSolicitud} className="mt-4">
            <input type="hidden" name="clienteId" value={cliente.id} />
            <input type="hidden" name="cedula" value={cliente.cedula} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="col-span-2 text-sm text-muted-foreground">
                Producto
                <select
                  name="productoId"
                  className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground"
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {(p.tasaEA * 100).toFixed(1)}% EA ({p.plazoMinMeses}-{p.plazoMaxMeses}{" "}
                      meses)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-muted-foreground">
                Valor de la moto (COP)
                <input
                  type="number"
                  name="valorMoto"
                  required
                  min={1}
                  placeholder="8000000"
                  className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 tabular-nums outline-none focus:border-primary"
                />
              </label>
              <label className="text-sm text-muted-foreground">
                Cuota inicial (COP)
                <input
                  type="number"
                  name="cuotaInicial"
                  min={0}
                  defaultValue={0}
                  placeholder="2000000"
                  className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 tabular-nums outline-none focus:border-primary"
                />
              </label>
              <label className="text-sm text-muted-foreground">
                Ingresos mensuales (COP)
                <input
                  type="number"
                  name="ingresos"
                  required
                  min={1}
                  placeholder="3000000"
                  className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 tabular-nums outline-none focus:border-primary"
                />
              </label>
              <fieldset className="col-span-2">
                <legend className="text-sm text-muted-foreground">Plazo</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PLAZOS.map((p, i) => (
                    <label key={p} className="cursor-pointer">
                      <input
                        type="radio"
                        name="plazo"
                        value={p}
                        defaultChecked={i === 1}
                        className="peer sr-only"
                      />
                      <span className="block rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                        {p} meses
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <Button type="submit" className="mt-5 w-full" size="lg">
              Evaluar solicitud
            </Button>
          </form>
        </Tarjeta>
      )}

      {/* Errores */}
      {errores.length > 0 && (
        <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errores.map((e) => (
            <p key={e}>• {e}</p>
          ))}
        </div>
      )}

      {/* Paso 3 · Decisión */}
      {evaluada && (
        <div className={cn("mt-6 rounded-2xl border-2 p-6", ESTILOS_RESULTADO[evaluada.decision.resultado])}>
          <div className="flex items-center gap-2">
            <Paso n={3} activo />
            <h2 className="font-semibold">Decisión de la política</h2>
          </div>
          <div className="mt-4 grid gap-5 md:grid-cols-[200px_1fr]">
            <div className="flex justify-center">
              <GaugeScore score={evaluada.decision.score} />
            </div>
            <div>
              <p className={cn("text-3xl font-black", COLOR_TITULO[evaluada.decision.resultado])}>
                {TITULOS[evaluada.decision.resultado]}
              </p>
              {evaluada.decision.cuotaEstimadaCentavos > 0 && (
                <p className="mt-1 text-lg">
                  Cuota mensual estimada: <strong>{pesos(evaluada.decision.cuotaEstimadaCentavos)}</strong>
                </p>
              )}
              <ul className="mt-4 space-y-1.5 text-sm">
                {evaluada.decision.razones.map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    {evaluada.decision.resultado === "NEGADO" ? (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    )}
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <a
            href="/solicitudes/nueva"
            className="mt-6 inline-block rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/80"
          >
            ← Nueva solicitud
          </a>
        </div>
      )}
    </div>
  );
}
