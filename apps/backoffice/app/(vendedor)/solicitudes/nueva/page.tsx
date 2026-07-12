"use client";

// Flujo estrella del vendedor: escanear cédula → armar solicitud → decisión
// en vivo con razones. CERO lógica de negocio aquí: todo lo decide el core
// vía las rutas API.

import type {
  ClienteResponse,
  DecisionResponse,
  ProductoResponse,
} from "@sumo/contracts";
import { useEffect, useState } from "react";
import { pesos, pesosACentavos } from "@/lib/format";

export default function NuevaSolicitud() {
  // paso 1: cliente
  const [cedula, setCedula] = useState("");
  const [cliente, setCliente] = useState<ClienteResponse | null>(null);
  const [escaneando, setEscaneando] = useState(false);

  // paso 2: solicitud
  const [productos, setProductos] = useState<ProductoResponse[]>([]);
  const [productoId, setProductoId] = useState("");
  const [valorMoto, setValorMoto] = useState("");
  const [cuotaInicial, setCuotaInicial] = useState("");
  const [plazo, setPlazo] = useState("24");
  const [ingresos, setIngresos] = useState("");
  const [evaluando, setEvaluando] = useState(false);

  // paso 3: resultado
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((lista: ProductoResponse[]) => {
        setProductos(lista);
        if (lista[0]) setProductoId(lista[0].id);
      })
      .catch(() => setErrores(["no se pudieron cargar los productos"]));
  }, []);

  async function escanearCedula() {
    setEscaneando(true);
    setErrores([]);
    setDecision(null);
    const r = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fuente: "escaner", codigo: cedula }),
    });
    const cuerpo = await r.json();
    if (!r.ok) {
      setErrores(cuerpo.errores ?? cuerpo.detalles ?? [cuerpo.error ?? "error escaneando"]);
      setCliente(null);
    } else {
      setCliente(cuerpo);
    }
    setEscaneando(false);
  }

  async function evaluar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return;
    setEvaluando(true);
    setErrores([]);
    setDecision(null);
    const r = await fetch("/api/solicitudes/evaluar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: cliente.id,
        cedula: cliente.cedula,
        productoId,
        valorMotoCentavos: pesosACentavos(Number(valorMoto)),
        cuotaInicialCentavos: pesosACentavos(Number(cuotaInicial || "0")),
        plazoMeses: Number(plazo),
        ingresosDeclaradosCentavos: pesosACentavos(Number(ingresos)),
      }),
    });
    const cuerpo = await r.json();
    if (!r.ok) {
      setErrores(cuerpo.errores ?? cuerpo.detalles ?? [cuerpo.error ?? "error evaluando"]);
    } else {
      setDecision(cuerpo);
    }
    setEvaluando(false);
  }

  const estilosResultado: Record<DecisionResponse["resultado"], string> = {
    APROBADO: "bg-emerald-950 border-emerald-500 text-emerald-300",
    NEGADO: "bg-red-950 border-red-500 text-red-300",
    REVISION_MANUAL: "bg-amber-950 border-amber-500 text-amber-300",
  };
  const titulos: Record<DecisionResponse["resultado"], string> = {
    APROBADO: "✓ APROBADO",
    NEGADO: "✗ NEGADO",
    REVISION_MANUAL: "⏳ REVISIÓN MANUAL",
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black">
          SU<span className="text-red-500">MOTO</span>{" "}
          <span className="font-normal text-zinc-400">· Nueva solicitud</span>
        </h1>

        {/* Paso 1: cliente */}
        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="font-semibold text-zinc-200">1 · Cliente</h2>
          <div className="mt-3 flex gap-3">
            <input
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Número de cédula"
              className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:border-red-500"
            />
            <button
              onClick={escanearCedula}
              disabled={escaneando || cedula.length < 6}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-500 disabled:opacity-40"
            >
              {escaneando ? "Escaneando…" : "📷 Escanear cédula"}
            </button>
          </div>
          {cliente && (
            <p className="mt-3 text-sm text-emerald-400">
              ✓ {cliente.nombres} {cliente.apellidos} — CC {cliente.cedula}
              {cliente.ciudad ? ` · ${cliente.ciudad}` : ""}
            </p>
          )}
        </section>

        {/* Paso 2: solicitud */}
        {cliente && (
          <form
            onSubmit={evaluar}
            className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <h2 className="font-semibold text-zinc-200">2 · Crédito</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="col-span-2 text-sm text-zinc-400">
                Producto
                <select
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
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
                  required
                  min={1}
                  value={valorMoto}
                  onChange={(e) => setValorMoto(e.target.value)}
                  placeholder="8000000"
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Cuota inicial (COP)
                <input
                  type="number"
                  min={0}
                  value={cuotaInicial}
                  onChange={(e) => setCuotaInicial(e.target.value)}
                  placeholder="2000000"
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Plazo (meses)
                <input
                  type="number"
                  required
                  min={1}
                  value={plazo}
                  onChange={(e) => setPlazo(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Ingresos mensuales (COP)
                <input
                  type="number"
                  required
                  min={1}
                  value={ingresos}
                  onChange={(e) => setIngresos(e.target.value)}
                  placeholder="3000000"
                  className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={evaluando}
              className="mt-5 w-full rounded-lg bg-red-600 py-2.5 font-semibold hover:bg-red-500 disabled:opacity-40"
            >
              {evaluando ? "Consultando buró y evaluando…" : "Evaluar solicitud"}
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
        {decision && (
          <section
            className={`mt-6 rounded-2xl border-2 p-6 ${estilosResultado[decision.resultado]}`}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-black">{titulos[decision.resultado]}</h2>
              <span className="text-sm opacity-80">score {decision.score}</span>
            </div>
            {decision.cuotaEstimadaCentavos > 0 && (
              <p className="mt-2 text-lg">
                Cuota mensual estimada:{" "}
                <strong>{pesos(decision.cuotaEstimadaCentavos)}</strong>
              </p>
            )}
            <ul className="mt-4 space-y-1 text-sm opacity-90">
              {decision.razones.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
