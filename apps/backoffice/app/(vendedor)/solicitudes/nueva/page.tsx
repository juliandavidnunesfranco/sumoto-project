// Flujo estrella del vendedor — 100% SSR (server component + server actions).
// El paso del wizard vive en searchParams: ?cedula= (paso 2), ?solicitudId=
// (resultado). CERO lógica de negocio: todo lo deciden las fachadas del core.

import Link from "next/link";
import { clientesService, originacionService } from "@/lib/core-server";
import { pesos } from "@/lib/format";
import { escanearCedula, evaluarSolicitud } from "./actions";

export const dynamic = "force-dynamic";

const ESTILOS_RESULTADO: Record<string, string> = {
  APROBADO: "bg-emerald-950 border-emerald-500 text-emerald-300",
  NEGADO: "bg-red-950 border-red-500 text-red-300",
  REVISION_MANUAL: "bg-amber-950 border-amber-500 text-amber-300",
};
const TITULOS: Record<string, string> = {
  APROBADO: "✓ APROBADO",
  NEGADO: "✗ NEGADO",
  REVISION_MANUAL: "⏳ REVISIÓN MANUAL",
};

export default async function NuevaSolicitud({
  searchParams,
}: {
  searchParams: Promise<{ cedula?: string; solicitudId?: string; error?: string }>;
}) {
  const params = await searchParams;
  const errores = params.error ? params.error.split("|") : [];

  // datos del paso actual, resueltos en el servidor vía fachadas del core
  const cliente = params.cedula
    ? await clientesService().buscarPorCedula(params.cedula)
    : null;
  const productos = cliente
    ? await originacionService().listarProductosActivos()
    : [];
  const evaluada = params.solicitudId
    ? await originacionService().solicitudEvaluada(params.solicitudId)
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black">
          SU<span className="text-red-500">MOTO</span>{" "}
          <span className="font-normal text-zinc-400">· Nueva solicitud</span>
        </h1>

        {/* Paso 1: cliente */}
        {!evaluada && (
          <form
            action={escanearCedula}
            className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="font-semibold text-zinc-200">1 · Cliente</h2>
            <div className="mt-3 flex gap-3">
              <input
                name="cedula"
                required
                minLength={6}
                defaultValue={params.cedula ?? ""}
                placeholder="Número de cédula"
                className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-500"
              >
                📷 Escanear cédula
              </button>
            </div>
            {cliente && (
              <p className="mt-3 text-sm text-emerald-400">
                ✓ {cliente.nombres} {cliente.apellidos} — CC {cliente.cedula}
                {cliente.ciudad ? ` · ${cliente.ciudad}` : ""}
              </p>
            )}
          </form>
        )}

        {/* Paso 2: solicitud */}
        {cliente && !evaluada && (
          <form
            action={evaluarSolicitud}
            className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="font-semibold text-zinc-200">2 · Crédito</h2>
            <input type="hidden" name="clienteId" value={cliente.id} />
            <input type="hidden" name="cedula" value={cliente.cedula} />
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="col-span-2 text-sm text-zinc-400">
                Producto
                <select
                  name="productoId"
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — {(p.tasaEA * 100).toFixed(1)}% EA (
                      {p.plazoMinMeses}-{p.plazoMaxMeses} meses)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-zinc-400">
                Valor de la moto (COP)
                <input
                  type="number"
                  name="valorMoto"
                  required
                  min={1}
                  placeholder="8000000"
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Cuota inicial (COP)
                <input
                  type="number"
                  name="cuotaInicial"
                  min={0}
                  defaultValue={0}
                  placeholder="2000000"
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Plazo (meses)
                <input
                  type="number"
                  name="plazo"
                  required
                  min={1}
                  defaultValue={24}
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Ingresos mensuales (COP)
                <input
                  type="number"
                  name="ingresos"
                  required
                  min={1}
                  placeholder="3000000"
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
            </div>
            <button
              type="submit"
              className="mt-5 w-full rounded-lg bg-red-600 py-2.5 font-semibold hover:bg-red-500"
            >
              Evaluar solicitud
            </button>
          </form>
        )}

        {/* Errores */}
        {errores.length > 0 && (
          <div className="mt-6 rounded-xl border border-red-800 bg-red-950 p-4 text-sm text-red-300">
            {errores.map((e) => (
              <p key={e}>• {e}</p>
            ))}
          </div>
        )}

        {/* Paso 3: decisión */}
        {evaluada && (
          <section
            className={`mt-8 rounded-2xl border-2 p-6 ${ESTILOS_RESULTADO[evaluada.decision.resultado]}`}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-black">
                {TITULOS[evaluada.decision.resultado]}
              </h2>
              <span className="text-sm opacity-80">
                score {evaluada.decision.score}
              </span>
            </div>
            {evaluada.decision.cuotaEstimadaCentavos > 0 && (
              <p className="mt-2 text-lg">
                Cuota mensual estimada:{" "}
                <strong>{pesos(evaluada.decision.cuotaEstimadaCentavos)}</strong>
              </p>
            )}
            <ul className="mt-4 space-y-1 text-sm opacity-90">
              {evaluada.decision.razones.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <Link
              href="/solicitudes/nueva"
              className="mt-6 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              ← Nueva solicitud
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
