// Flujo estrella del vendedor — 100% SSR (server component + server actions).
// El paso del wizard vive en searchParams (incluida la pestaña activa). CERO
// lógica de negocio: todo lo deciden las fachadas del core. Componentes
// chicos (una responsabilidad cada uno) en components/vendedor/.

import Link from "next/link";
import { ScanLine } from "lucide-react";
import { generarPlanDePagos, montoAFinanciarCentavos } from "@sumo/core";
import { obtenerSesion } from "@/lib/auth";
import { catalogoService, clientesService, originacionService } from "@/lib/core-server";
import { CARGOS_ADICIONALES_DEMO } from "@/lib/cargos-adicionales";
import { pesos } from "@/lib/format";
import { PageHeader, Tarjeta } from "@/components/panel/ui";
import { GaleriaMotos } from "@/components/vendedor/galeria-motos";
import { InputBusqueda } from "@/components/shared/input-busqueda";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";
import { TarjetaCliente } from "@/components/vendedor/tarjeta-cliente";
import { TarjetaDecision } from "@/components/vendedor/tarjeta-decision";
import { PlanDePagos } from "@/components/vendedor/plan-de-pagos";
import { SubirDocumentos } from "@/components/vendedor/subir-documentos";
import { DescargasDocumento } from "@/components/vendedor/descargas-documento";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { escanearCedula, evaluarSolicitud } from "./actions";

export const dynamic = "force-dynamic";

const PLAZOS = [12, 24, 36, 48];

type PasoId = "cliente" | "moto" | "credito" | "decision" | "documentos";

const PASOS: { id: PasoId; n: number; label: string }[] = [
  { id: "cliente", n: 1, label: "Cliente" },
  { id: "moto", n: 2, label: "Moto" },
  { id: "credito", n: 3, label: "Crédito" },
  { id: "decision", n: 4, label: "Decisión" },
  { id: "documentos", n: 5, label: "Documentos" },
];

function NumeroPaso({ n, activo }: { n: number; activo?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold",
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
  searchParams: Promise<{
    cedula?: string;
    motoId?: string;
    solicitudId?: string;
    error?: string;
    docSubido?: string;
    paso?: string;
    motoQuery?: string;
    motoPagina?: string;
    motoPorPagina?: string;
  }>;
}) {
  const params = await searchParams;
  const errores = params.error ? params.error.split("|") : [];

  // El core corre con SERVICE_ROLE (la RLS no lo acota): el scoping por
  // tienda se replica aquí — un vendedor con una URL ajena (cédula o
  // solicitudId de otra tienda) ve "no encontrado", no datos ajenos.
  const sesion = await obtenerSesion();
  const tiendaId = sesion?.tiendaId ?? null;

  const clienteCrudo =
    params.cedula && tiendaId ? await clientesService().buscarPorCedula(params.cedula) : null;
  const cliente = clienteCrudo && clienteCrudo.tiendaId === tiendaId ? clienteCrudo : null;

  const productos = cliente ? await originacionService().listarProductosActivos() : [];
  const evaluadaCruda =
    params.solicitudId && tiendaId
      ? await originacionService().solicitudEvaluada(params.solicitudId)
      : null;
  const evaluada =
    evaluadaCruda && evaluadaCruda.solicitud.tiendaId === tiendaId ? evaluadaCruda : null;
  const motoPagina = Math.max(1, Number(params.motoPagina) || 1);
  const motoPorPagina = [10, 20, 40, 50].includes(Number(params.motoPorPagina))
    ? Number(params.motoPorPagina)
    : 10;
  const resultadoMotos = cliente
    ? await catalogoService().buscarMotos({
        query: params.motoQuery,
        pagina: motoPagina,
        porPagina: motoPorPagina,
      })
    : { items: [], total: 0 };
  const moto = params.motoId ? await catalogoService().buscarMotoPorId(params.motoId) : null;
  const producto = evaluada
    ? await originacionService().buscarProducto(evaluada.solicitud.productoId)
    : null;

  const puedeContinuar = evaluada && evaluada.decision.resultado !== "NEGADO" && producto;
  const cuotas = puedeContinuar
    ? generarPlanDePagos({
        montoCentavos: montoAFinanciarCentavos(evaluada.solicitud),
        tasaEA: producto.tasaEA,
        plazoMeses: evaluada.solicitud.plazoMeses,
        fechaDesembolso: new Date().toISOString().slice(0, 10),
      })
    : [];

  const disponible: Record<PasoId, boolean> = {
    cliente: true,
    moto: !!cliente,
    credito: !!cliente && !!moto,
    decision: !!evaluada,
    documentos: !!puedeContinuar,
  };
  const pasoPorDefecto: PasoId = evaluada ? "decision" : moto ? "credito" : cliente ? "moto" : "cliente";
  const pasoActual: PasoId =
    params.paso && disponible[params.paso as PasoId] ? (params.paso as PasoId) : pasoPorDefecto;

  // El buró SOLO se consulta cuando la pestaña activa lo muestra — con el
  // mock es gratis, con Experian real cada render del wizard costaría una
  // consulta (y las de más volumen se facturan por transacción).
  const reporteRiesgo =
    cliente && pasoActual === "cliente"
      ? await originacionService().consultarRiesgo(cliente.cedula)
      : null;

  // base común de todos los href del wizard: conserva el contexto completo
  // (cedula, moto elegida, solicitud y estado de búsqueda/paginación)
  function qsBase(): URLSearchParams {
    const qs = new URLSearchParams();
    if (params.cedula) qs.set("cedula", params.cedula);
    if (params.motoId) qs.set("motoId", params.motoId);
    if (params.solicitudId) qs.set("solicitudId", params.solicitudId);
    if (params.motoQuery) qs.set("motoQuery", params.motoQuery);
    if (params.motoPagina) qs.set("motoPagina", params.motoPagina);
    if (params.motoPorPagina) qs.set("motoPorPagina", params.motoPorPagina);
    return qs;
  }

  function hrefPaso(id: PasoId): string {
    const qs = qsBase();
    qs.set("paso", id);
    return `/solicitudes/nueva?${qs.toString()}`;
  }

  function hrefPaginaMoto(pagina: number): string {
    const qs = qsBase();
    qs.set("motoPorPagina", String(motoPorPagina));
    qs.set("motoPagina", String(pagina));
    qs.set("paso", "moto");
    return `/solicitudes/nueva?${qs.toString()}`;
  }

  function hrefSeleccionMoto(motoId: string): string {
    const qs = qsBase();
    qs.set("motoId", motoId);
    qs.set("paso", "moto");
    return `/solicitudes/nueva?${qs.toString()}`;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo="Solicitud de crédito"
        descripcion="Escanea la cédula, arma el crédito y obtén la decisión en minutos."
      />

      <Tabs value={pasoActual} className="mt-2">
        <TabsList className="w-full justify-between">
          {PASOS.map((p) => (
            <TabsTrigger
              key={p.id}
              value={p.id}
              disabled={!disponible[p.id]}
              nativeButton={false}
              render={<Link href={hrefPaso(p.id)} />}
            >
              <span className="flex items-center gap-1.5">
                <NumeroPaso n={p.n} activo={p.id === pasoActual} />
                <span className="hidden sm:inline">{p.label}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {errores.length > 0 && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {errores.map((e) => (
              <p key={e}>• {e}</p>
            ))}
          </div>
        )}

        {/* Paso 1 · Cliente + riesgo */}
        <TabsContent value="cliente" className="mt-4">
          <Tarjeta>
            <h2 className="font-semibold font-headline text-3xl">Escanear cédula del solicitante</h2>
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
              <Button
                type="submit"
                variant="ghost"
                className="border-transparent rounded-none font-headline text-lg transition-colors duration-200 hover:border-black hover:bg-transparent"
              >
                <ScanLine className="size-4" />
                Escanear cédula
              </Button>
            </form>

            {cliente && (
              <div className="mt-5">
                <TarjetaCliente
                  cliente={cliente}
                  reporteRiesgo={reporteRiesgo?.ok ? reporteRiesgo.valor : null}
                />
              </div>
            )}
          </Tarjeta>
        </TabsContent>

        {/* Paso 2 · Elegir moto — catálogo real del core (módulo catalogo) */}
        <TabsContent value="moto" className="mt-4">
          <Tarjeta>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold font-headline text-3xl">Elegir la moto</h2>
              <InputBusqueda
                param="motoQuery"
                placeholder="Buscar moto…"
                limpiarParams={["motoPagina"]}
                className="w-48 sm:w-64"
              />
            </div>
            {cliente && (
              <div className="mt-4">
                <GaleriaMotos
                  motoId={params.motoId}
                  motos={resultadoMotos.items}
                  hrefMoto={hrefSeleccionMoto}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <SelectorPorPagina param="motoPorPagina" resetParam="motoPagina" />
                  <Paginacion
                    pagina={motoPagina}
                    porPagina={motoPorPagina}
                    total={resultadoMotos.total}
                    hrefPagina={hrefPaginaMoto}
                    sustantivo={["moto", "motos"]}
                  />
                </div>
              </div>
            )}
          </Tarjeta>
        </TabsContent>

        {/* Paso 3 · Crédito */}
        <TabsContent value="credito" className="mt-4">
          <Tarjeta>
            <h2 className="font-semibold font-headline text-3xl">Arma el crédito</h2>
            {cliente && moto && (
              <form action={evaluarSolicitud} className="mt-4">
                <input type="hidden" name="clienteId" value={cliente.id} />
                <input type="hidden" name="cedula" value={cliente.cedula} />
                <input type="hidden" name="motoId" value={moto.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="col-span-2 text-sm text-muted-foreground">
                    Producto
                    <select
                      name="productoId"
                      className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground"
                    >
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} — {(p.tasaEA * 100).toFixed(1)}% EA ({p.plazoMinMeses}-
                          {p.plazoMaxMeses} meses)
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
                      defaultValue={Math.round(moto.precioCreditoCentavos / 100)}
                      className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 tabular-nums outline-none focus:border-primary"
                    />
                  </label>
                  <label className="text-sm text-muted-foreground">
                    Cuota inicial (COP)
                    <input
                      type="number"
                      name="cuotaInicial"
                      min={0}
                      defaultValue={Math.round((moto.precioCreditoCentavos * 0.2) / 100)}
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
                      defaultValue={
                        cliente.ingresosDeclaradosCentavos
                          ? Math.round(cliente.ingresosDeclaradosCentavos / 100)
                          : undefined
                      }
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
                  <fieldset className="col-span-2">
                    <legend className="text-sm text-muted-foreground">
                      Cargos adicionales (se suman al monto a financiar)
                    </legend>
                    <div className="mt-2 flex flex-col gap-2">
                      {CARGOS_ADICIONALES_DEMO.map((cargo) => (
                        <label
                          key={cargo.id}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2 text-sm has-checked:border-primary"
                        >
                          <span className="flex items-center gap-2">
                            {/* viaja el id, nunca el monto: el precio lo
                                resuelve el servidor (un form manipulado no
                                puede inventar montos) */}
                            <input type="checkbox" name="cargo" value={cargo.id} />
                            {cargo.nombre}
                          </span>
                          <span className="text-muted-foreground">{pesos(cargo.montoCentavos)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <Button type="submit" className="mt-5 w-full" size="lg">
                  Evaluar solicitud
                </Button>
              </form>
            )}
          </Tarjeta>
        </TabsContent>

        {/* Paso 4 · Decisión */}
        <TabsContent value="decision" className="mt-4">
          {evaluada && <TarjetaDecision decision={evaluada.decision} />}
          {evaluada && (
            <Link
              href="/solicitudes/nueva"
              className="mt-6 inline-block border border-transparent p-4 text-lg font-semibold text-foreground hover:border-black hover:text-muted-foreground"
            >
              Nueva solicitud
            </Link>
          )}
        </TabsContent>

        {/* Paso 5 · Documentos (cosmético) + descargas de demostración */}
        <TabsContent value="documentos" className="mt-4">
          {puedeContinuar && evaluada && (
            <>
              <Tarjeta className="my-6">
                <h2 className="font-semibold font-headline text-3xl">Documentos</h2>
                {params.docSubido && (
                  <p className="mt-3 border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                    Documento archivado en el expediente — el financiero lo verá
                    al revisar el desembolso.
                  </p>
                )}
                <div className="mt-4">
                  <SubirDocumentos
                    solicitudId={params.solicitudId!}
                    cedula={cliente?.cedula ?? ""}
                    motoId={params.motoId}
                  />
                </div>
                <div className="mt-5 border-t border-border pt-5">
                  <DescargasDocumento
                    clienteNombre={cliente ? `${cliente.nombres} ${cliente.apellidos}` : "Cliente"}
                    cedula={cliente?.cedula ?? ""}
                    motoNombre={moto?.nombre ?? "Moto"}
                    montoCentavos={montoAFinanciarCentavos(evaluada.solicitud)}
                    plazoMeses={evaluada.solicitud.plazoMeses}
                    cuotaCentavos={evaluada.decision.cuotaEstimadaCentavos}
                    cuotas={cuotas}
                  />
                </div>
              </Tarjeta>
              <Tarjeta>
                <h3 className="font-semibold font-headline text-3xl">Plan de pagos</h3>
                <div className="mt-4">
                  <PlanDePagos cuotas={cuotas} />
                </div>
              </Tarjeta>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
