// Server component puro: el form postea a la server action (funciona sin JS).

import { Marca } from "@/components/marca";
import { Button } from "@/components/ui/button";
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
    <main className="flex min-h-screen items-center justify-center bg-background">
      <form
        action={ingresar}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl"
      >
        <Marca className="text-3xl" sub="Crédito" />
        <p className="mt-1 text-sm text-muted-foreground">Sistema de crédito — backoffice</p>

        <label className="mt-6 block text-sm text-muted-foreground">
          Correo
          <input
            type="email"
            name="email"
            required
            placeholder="vendedor@sumoto.co"
            className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </label>
        <label className="mt-4 block text-sm text-muted-foreground">
          Contraseña
          <input
            type="password"
            name="password"
            required
            className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground outline-none focus:border-primary"
          />
        </label>

        {mensaje && <p className="mt-4 text-sm text-destructive">{mensaje}</p>}

        <Button type="submit" className="mt-6 w-full" size="lg">
          Ingresar
        </Button>
      </form>
    </main>
  );
}
