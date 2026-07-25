// Administración de productos de crédito y sus políticas de decisión — 100%
// SSR. El simulador corre el motor REAL (decidirSolicitud), sin persistir
// nada: es una vista previa antes de guardar.

import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { originacionService } from "@/lib/core-server";
import { pesos } from "@/lib/format";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { CampoSlider } from "@/components/financiero/campo-slider";
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
    nuevo?: string;
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
        <div className="mb-6 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errores.map((e) => (
            <p key={e}>• {e}</p>
          ))}
        </div>
      )}
      {params.guardado && (
        <div className="mb-6 flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <CheckCircle2 className="size-4" /> Políticas guardadas.
        </div>
      )}

      {/* La lista de productos vive en el submenú del sidebar (estilo botón
          "Ingresar" del home) — la vista queda entera para reglas + simulador. */}
      {params.nuevo ? (
        <Tarjeta className="max-w-xl p-6">
          <h3 className="font-headline text-3xl font-bold tracking-tight">Nuevo producto</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Define las condiciones y las reglas iniciales. Podrás ajustarlas
            después desde su apartado de políticas.
          </p>
          <form action={crearProducto} className="mt-5 space-y-4">
              <input
                name="nombre"
                required
                placeholder="Nombre del producto"
                className="w-full rounded-lg border border-input bg-secondary px-2.5 py-1.5 text-sm"
              />
              <CampoSlider
                label="Tasa EA"
                name="tasaEA"
                min={10}
                max={60}
                step={0.5}
                defaultValue={28}
                unidad="%"
              />
              <CampoSlider
                label="Plazo mínimo"
                name="plazoMinMeses"
                min={6}
                max={36}
                step={6}
                defaultValue={6}
                unidad="meses"
              />
              <CampoSlider
                label="Plazo máximo"
                name="plazoMaxMeses"
                min={12}
                max={72}
                step={6}
                defaultValue={36}
                unidad="meses"
              />
              <CampoSlider
                label="Score mínimo"
                name="scoreMinimo"
                min={150}
                max={950}
                step={10}
                defaultValue={600}
                unidad="pts"
              />
              <CampoSlider
                label="Cuota máxima / ingreso"
                name="cuotaMaximaPorcentajeIngreso"
                min={10}
                max={60}
                step={5}
                defaultValue={35}
                unidad="%"
              />
              <CampoSlider
                label="LTV máximo"
                name="ltvMaximo"
                min={10}
                max={100}
                step={5}
                defaultValue={90}
                unidad="%"
              />
              <Button type="submit" size="sm" className="w-full">
                Crear producto
              </Button>
            </form>
          </Tarjeta>
      ) : /* Reglas del producto seleccionado + simulador */
      seleccionado ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <h2 className="font-headline text-3xl font-bold tracking-tight">
                {seleccionado.nombre} — políticas
              </h2>
              {/* key por producto: al cambiar de producto los sliders (client)
                  deben remontar con los valores del nuevo, no arrastrar estado */}
              <form
                key={seleccionado.id}
                action={actualizarReglas}
                className="mt-4 space-y-4"
              >
                <input type="hidden" name="productoId" value={seleccionado.id} />
                <Tarjeta className="p-5">
                  <CampoSlider
                    label="Score mínimo"
                    descripcion="Por debajo de este puntaje de buró la solicitud se niega."
                    name="scoreMinimo"
                    min={150}
                    max={950}
                    step={10}
                    defaultValue={seleccionado.reglasDecision.scoreMinimo}
                    unidad="pts"
                  />
                </Tarjeta>
                <Tarjeta className="p-5">
                  <CampoSlider
                    label="Score de revisión manual"
                    descripcion="Entre el mínimo y este puntaje, la solicitud pasa a revisión."
                    name="scoreRevision"
                    min={150}
                    max={950}
                    step={10}
                    defaultValue={
                      seleccionado.reglasDecision.scoreRevision ??
                      Math.min(seleccionado.reglasDecision.scoreMinimo + 50, 950)
                    }
                    unidad="pts"
                    opcional
                    activoInicial={seleccionado.reglasDecision.scoreRevision !== undefined}
                  />
                </Tarjeta>
                <Tarjeta className="p-5">
                  <CampoSlider
                    label="Cuota máxima sobre el ingreso"
                    descripcion="La cuota mensual no puede superar este porcentaje del ingreso declarado."
                    name="cuotaMaximaPorcentajeIngreso"
                    min={10}
                    max={60}
                    step={5}
                    defaultValue={Math.round(
                      seleccionado.reglasDecision.cuotaMaximaPorcentajeIngreso * 100,
                    )}
                    unidad="%"
                  />
                </Tarjeta>
                <Tarjeta className="p-5">
                  <CampoSlider
                    label="LTV máximo"
                    descripcion="Porcentaje máximo del valor de la moto que se financia."
                    name="ltvMaximo"
                    min={10}
                    max={100}
                    step={5}
                    defaultValue={Math.round(seleccionado.reglasDecision.ltvMaximo * 100)}
                    unidad="%"
                  />
                </Tarjeta>
                <Tarjeta className="p-5">
                  <CampoSlider
                    label="Ingreso mínimo"
                    descripcion="Ingresos declarados por debajo de este monto niegan la solicitud."
                    name="ingresoMinimo"
                    min={0}
                    max={10_000_000}
                    step={100_000}
                    defaultValue={
                      seleccionado.reglasDecision.ingresoMinimoCentavos !== undefined
                        ? seleccionado.reglasDecision.ingresoMinimoCentavos / 100
                        : 1_300_000
                    }
                    formato="pesos"
                    opcional
                    activoInicial={
                      seleccionado.reglasDecision.ingresoMinimoCentavos !== undefined
                    }
                  />
                </Tarjeta>
                <Tarjeta className="p-5">
                  <CampoSlider
                    label="Mora máxima tolerada en buró"
                    descripcion="Con mora reportada por encima de estos días, la solicitud se niega."
                    name="moraMaximaDias"
                    min={0}
                    max={120}
                    step={5}
                    defaultValue={seleccionado.reglasDecision.moraMaximaDias ?? 60}
                    unidad="días"
                    opcional
                    activoInicial={seleccionado.reglasDecision.moraMaximaDias !== undefined}
                  />
                </Tarjeta>
                <Button type="submit" className="w-full">
                  Guardar políticas
                </Button>
              </form>
            </div>

            <Tarjeta className="h-fit">
              <h3 className="font-headline text-lg font-bold tracking-tight">Simulador de decisión</h3>
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
                    "mt-4 border p-4 text-sm",
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
            Aún no hay productos de crédito.{" "}
            <Link href="/politicas?nuevo=1" className="font-headline font-bold underline">
              Crea el primero
            </Link>{" "}
            desde el submenú del sidebar.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
