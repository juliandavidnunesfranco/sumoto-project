// Server component puro: el form postea a la server action (funciona sin JS).

import { ingresar } from "./actions";

const MENSAJES: Record<string, string> = {
  credenciales: "Credenciales inválidas.",
  "sin-perfil": "Tu usuario no tiene perfil asignado.",
  "faltan-datos": "Correo y contraseña son obligatorios.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; denegado?: string }>;
}) {
  const params = await searchParams;
  const mensaje = params.denegado
    ? "Tu rol no tiene acceso a esa sección."
    : params.error
      ? (MENSAJES[params.error] ?? "No fue posible ingresar.")
      : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950">
      <form
        action={ingresar}
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
            name="email"
            required
            placeholder="vendedor@sumoto.co"
            className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
        </label>
        <label className="mt-4 block text-sm text-zinc-300">
          Contraseña
          <input
            type="password"
            name="password"
            required
            className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:border-red-500"
          />
        </label>

        {mensaje && <p className="mt-4 text-sm text-red-400">{mensaje}</p>}

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500"
        >
          Ingresar
        </button>
      </form>
    </main>
  );
}
