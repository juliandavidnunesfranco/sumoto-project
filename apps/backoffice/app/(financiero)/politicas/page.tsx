// Administración de productos de crédito y sus políticas de decisión — 100%
// SSR. El simulador corre el motor REAL (decidirSolicitud), sin persistir
// nada: es una vista previa antes de guardar.

import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { originacionService } from "@/lib/core-server";
import { pesos } from "@/lib/format";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { actualizarReglas, crearProducto, simularDecision } from "./actions";

export const dynamic = "force-dynamic";

const ESTILOS_RESULTADO: Record<string, string> = {
  APROBADO: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  NEGADO: "border-destructive/40 bg-destructive/10 text-destructive",
  REVISION_MANUAL: "border-amber-500/40 bg-amber-500/10 text-amber-400",
};

export default async function PoliticasPage({
  searchParams,
}: {
  searchParams: Promise<{
    productoId?: string;
    error?: string;
    guardado?: string;
    simResultado?: string;
    simScore?: string;
    simCuota?: string;
    simRazones?: string;
  }>;
}) {
  const params = await searchParams;
  const errores = params.error ? params.error.split("|") : [];

  const productos = await originacionService().listarProductosActivos();
  const seleccionado = params.productoId
    ? (productos.find((p) => p.id === params.productoId) ??
      (await originacionService().buscarProducto(params.productoId)))
    : (productos[0] ?? null);

  const simulacion = params.simResultado
    ? {
        resultado: params.simResultado,
        score: Number(params.simScore ?? 0),
        cuota: Number(params.simCuota ?? 0),
        razones: params.simRazones?.split("|") ?? [],
      }
    : null;

  return (
    <div>
      <PageHeader
        titulo="Políticas de crédito"
        descripcion="Crea productos y ajusta las reglas que aprueban o niegan las solicitudes. Usa el simulador antes de guardar."
      />

      {errores.length > 0 && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errores.map((e) => (
            <p key={e}>• {e}</p>
          ))}
        </div>
      )}
      {params.guardado && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <CheckCircle2 className="size-4" /> Políticas guardadas.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Lista de productos */}
        <div className="space-y-3">
          {productos.map((p) => (
            <Link key={p.id} href={`/politicas?productoId=${p.id}`}>
              <Tarjeta
                className={cn(
                  "p-4 transition-colors hover:border-primary/40",
                  p.id === seleccionado?.id && "border-primary",
                )}
              >
                <p className="font-semibold">{p.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {(p.tasaEA * 100).toFixed(1)}% EA · {p.plazoMinMeses}-{p.plazoMaxMeses} meses
                </p>
              </Tarjeta>
            </Link>
          ))}

          {/* Crear producto nuevo */}
          <Tarjeta className="p-4">
            <h3 className="text-sm font-semibold">Nuevo producto</h3>
            <form action={crearProducto} className="mt-3 space-y-2">
              <input
                name="nombre"
                required
                placeholder="Nombre"
                className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <input
                  name="tasaEA"
                  type="number"
                  step="0.1"
                  required
                  placeholder="% EA"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
                <input
                  name="plazoMinMeses"
                  type="number"
                  required
                  placeholder="Plazo mín"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
                <input
                  name="plazoMaxMeses"
                  type="number"
                  required
                  placeholder="Plazo máx"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
              </div>
              <input
                name="scoreMinimo"
                type="number"
                required
                placeholder="Score mínimo (150-950)"
                className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
              />
              <input
                name="cuotaMaximaPorcentajeIngreso"
                type="number"
                required
                placeholder="Cuota máx % ingreso"
                className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
              />
              <input
                name="ltvMaximo"
                type="number"
                required
                placeholder="LTV máximo %"
                className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
              />
              <Button type="submit" size="sm" className="w-full">
                Crear producto
              </Button>
            </form>
          </Tarjeta>
        </div>

        {/* Reglas del producto seleccionado + simulador */}
        {seleccionado ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Tarjeta>
              <h2 className="font-semibold">{seleccionado.nombre} — políticas</h2>
              <form action={actualizarReglas} className="mt-4 space-y-4">
                <input type="hidden" name="productoId" value={seleccionado.id} />
                <Campo
                  label="Score mínimo (150-950)"
                  name="scoreMinimo"
                  defaultValue={seleccionado.reglasDecision.scoreMinimo}
                />
                <Campo
                  label="Score de revisión manual (opcional)"
                  name="scoreRevision"
                  defaultValue={seleccionado.reglasDecision.scoreRevision}
                />
                <Campo
                  label="Cuota máxima como % del ingreso"
                  name="cuotaMaximaPorcentajeIngreso"
                  defaultValue={seleccionado.reglasDecision.cuotaMaximaPorcentajeIngreso * 100}
                />
                <Campo
                  label="LTV máximo (%)"
                  name="ltvMaximo"
                  defaultValue={seleccionado.reglasDecision.ltvMaximo * 100}
                />
                <Campo
                  label="Ingreso mínimo (COP, opcional)"
                  name="ingresoMinimo"
                  defaultValue={
                    seleccionado.reglasDecision.ingresoMinimoCentavos !== undefined
                      ? seleccionado.reglasDecision.ingresoMinimoCentavos / 100
                      : undefined
                  }
                />
                <Campo
                  label="Mora máxima tolerada (días, opcional)"
                  name="moraMaximaDias"
                  defaultValue={seleccionado.reglasDecision.moraMaximaDias}
                />
                <Button type="submit" className="w-full">
                  Guardar políticas
                </Button>
              </form>
            </Tarjeta>

            <Tarjeta className="h-fit">
              <h3 className="font-semibold">Simulador de decisión</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Prueba las políticas de arriba contra un caso antes de guardarlas.
              </p>
              <form action={simularDecision} className="mt-4 space-y-2">
                <input type="hidden" name="productoId" value={seleccionado.id} />
                <input type="hidden" name="tasaEAPrueba" value={seleccionado.tasaEA * 100} />
                {/* copia las políticas visibles arriba: el simulador es preview, no lee el form vecino */}
                <input
                  type="hidden"
                  name="scoreMinimo"
                  value={seleccionado.reglasDecision.scoreMinimo}
                />
                <input
                  type="hidden"
                  name="scoreRevision"
                  value={seleccionado.reglasDecision.scoreRevision ?? ""}
                />
                <input
                  type="hidden"
                  name="cuotaMaximaPorcentajeIngreso"
                  value={seleccionado.reglasDecision.cuotaMaximaPorcentajeIngreso * 100}
                />
                <input
                  type="hidden"
                  name="ltvMaximo"
                  value={seleccionado.reglasDecision.ltvMaximo * 100}
                />
                <input
                  type="hidden"
                  name="ingresoMinimo"
                  value={
                    seleccionado.reglasDecision.ingresoMinimoCentavos !== undefined
                      ? seleccionado.reglasDecision.ingresoMinimoCentavos / 100
                      : ""
                  }
                />
                <input
                  type="hidden"
                  name="moraMaximaDias"
                  value={seleccionado.reglasDecision.moraMaximaDias ?? ""}
                />
                <input
                  name="cedulaPrueba"
                  required
                  placeholder="Cédula de prueba"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
                <input
                  name="valorMotoPrueba"
                  type="number"
                  required
                  placeholder="Valor moto (COP)"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
                <input
                  name="cuotaInicialPrueba"
                  type="number"
                  defaultValue={0}
                  placeholder="Cuota inicial (COP)"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
                <input
                  name="ingresosPrueba"
                  type="number"
                  required
                  placeholder="Ingresos declarados (COP)"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
                <input
                  name="plazoPrueba"
                  type="number"
                  defaultValue={24}
                  placeholder="Plazo (meses)"
                  className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
                />
                <Button type="submit" variant="secondary" className="w-full">
                  Simular decisión
                </Button>
              </form>

              {simulacion ? (
                <div
                  className={cn(
                    "mt-4 rounded-xl border p-4 text-sm",
                    ESTILOS_RESULTADO[simulacion.resultado],
                  )}
                >
                  <p className="text-xs uppercase tracking-wide opacity-80">Resultado</p>
                  <p className="text-lg font-bold">
                    {simulacion.resultado.replace("_", " ")} · score {simulacion.score}
                  </p>
                  {simulacion.cuota > 0 && <p className="mt-1">Cuota: {pesos(simulacion.cuota)}</p>}
                  <ul className="mt-3 space-y-1">
                    {simulacion.razones.map((r) => (
                      <li key={r} className="flex items-start gap-1.5">
                        {simulacion.resultado === "NEGADO" ? (
                          <XCircle className="mt-0.5 size-3.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                        )}
                        <span className="text-xs opacity-90">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Tarjeta>
          </div>
        ) : (
          <Tarjeta>
            <p className="text-sm text-muted-foreground">
              Aún no hay productos de crédito. Crea el primero con el formulario de la izquierda.
            </p>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}

function Campo({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: number;
}) {
  return (
    <label className="block text-sm text-muted-foreground">
      {label}
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2 tabular-nums text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}
