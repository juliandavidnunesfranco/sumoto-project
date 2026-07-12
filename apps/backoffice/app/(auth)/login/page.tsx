"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("denegado") ? "Tu rol no tiene acceso a esa sección." : null,
  );
  const [cargando, setCargando] = useState(false);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Credenciales inválidas.");
      setCargando(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950">
      <form
        onSubmit={ingresar}
        className="w-full max-w-sm rounded-2xl bg-zinc-900 p-8 shadow-xl border border-zinc-800"
      >
        <h1 className="text-3xl font-black tracking-tight text-white">
          SU<span className="text-red-500">MOTO</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sistema de crédito — backoffice
        </p>

        <label className="mt-6 block text-sm text-zinc-300">
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendedor@sumoto.co"
            className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
        </label>
        <label className="mt-4 block text-sm text-zinc-300">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-red-500"
          />
        </label>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="mt-6 w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  );
}
