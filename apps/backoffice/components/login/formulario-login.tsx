"use client";

// Client component: la ÚNICA razón es la interactividad (autocompletar
// usuarios demo + estado de envío). La Server Action de fondo (ingresar) no
// cambia — sigue funcionando como POST normal si el navegador no tiene JS.

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import type { Rol } from "@sumo/core";
import { ingresar } from "@/app/(auth)/login/actions";
import { ROLES } from "@/lib/roles-nav";
import Image from "next/image";

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
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-fit self-center border border-transparent font-headline text-4xl font-black p-4 hover:text-muted-foreground hover:border-black disabled:opacity-60 transition-colors duration-200"
    >
      {pending ? "Ingresando…" : "Ingresar"}
    </button>
  );
}

export function FormularioLogin({ mensaje, next }: { mensaje: string | null; next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function usarDemo(correo: string) {
    setEmail(correo);
    setPassword("sumoto123");
  }

  return (
    <div className="w-full max-w-sm ">
      <Link
        href="/"
        className="fixed top-10 left-4 flex items-center gap-2 border border-transparent font-headline text-2xl font-black p-4 hover:text-muted-foreground hover:border-black transition-colors duration-200"
      >
        <ArrowLeft className="size-5" />
        Volver
      </Link>

      <div className="flex flex-col items-center text-center">
        <Image
          src={"/motos/cropped-Logotipo-Su-Moto-sa-PNG-02-2048x561.png"}
          width={300}
          height={300}
          alt="logo"
          />
        <h1 className="mt-6 font-headline text-4xl font-bold">Ingresa al tablero</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu rol determina las herramientas que verás al entrar.
        </p>
      </div>

      <form action={ingresar} className="mt-8 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
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

      <div className="mt-8">
        <p className="text-xs font-medium text-muted-foreground">
          Usuarios de demo · contraseña <code className="text-foreground">sumoto123</code>
        </p>
        <div className="mt-3 flex flex-col">
          {USUARIOS_DEMO.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => usarDemo(u.email)}
              className="border border-transparent p-2 text-justify font-headline text-sm font-bold transition-colors duration-200 hover:border-black hover:text-muted-foreground"
            >
              {ROLES[u.rol].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
