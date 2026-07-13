"use client";

// Client component: la ÚNICA razón es la interactividad (autocompletar
// usuarios demo + estado de envío). La Server Action de fondo (ingresar) no
// cambia — sigue funcionando como POST normal si el navegador no tiene JS.

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, ArrowLeft, LogIn } from "lucide-react";
import type { Rol } from "@sumo/core";
import { ingresar } from "@/app/(auth)/login/actions";
import { ROLES } from "@/lib/roles-nav";
import { Marca } from "@/components/marca";
import { Button } from "@/components/ui/button";

const USUARIOS_DEMO: { email: string; rol: Rol }[] = [
  { email: "vendedor@sumoto.co", rol: "vendedor" },
  { email: "manager@sumoto.co", rol: "manager" },
  { email: "financiero@sumoto.co", rol: "financiero" },
  { email: "contable@sumoto.co", rol: "contable" },
  { email: "ceo@sumoto.co", rol: "ceo" },
];

function BotonIngresar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="mt-2">
      <LogIn className="size-4" />
      {pending ? "Ingresando…" : "Ingresar"}
    </Button>
  );
}

export function FormularioLogin({ mensaje }: { mensaje: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function usarDemo(correo: string) {
    setEmail(correo);
    setPassword("sumoto123");
  }

  return (
    <div className="w-full max-w-sm">
      <Link
        href="/"
        className="mb-8 mr-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Link>

      <Marca className="text-2xl" sub="CRÉDITO" />
      <h1 className="mt-6 text-2xl font-bold">Ingresa a tu tablero</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tu rol determina las herramientas que verás al entrar.
      </p>

      <form action={ingresar} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Correo</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@sumoto.co"
            className="rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Contraseña</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-lg border border-input bg-secondary px-3 py-2.5 text-foreground outline-none transition-colors focus:border-primary"
          />
        </label>

        {mensaje ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {mensaje}
          </p>
        ) : null}

        <BotonIngresar />
      </form>

      <div className="mt-8 rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Usuarios de demo · contraseña <code className="text-foreground">sumoto123</code>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {USUARIOS_DEMO.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => usarDemo(u.email)}
              className="rounded-full border border-border bg-secondary px-3 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
            >
              {ROLES[u.rol].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
