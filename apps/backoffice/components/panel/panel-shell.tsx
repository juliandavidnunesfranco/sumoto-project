"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import type { Sesion } from "@/lib/auth";
import { ROLES } from "@/lib/roles-nav";
import { cerrarSesion } from "@/app/(auth)/login/actions";
import { Marca } from "@/components/marca";
import { cn } from "@/lib/cn";

export function PanelShell({
  sesion,
  children,
}: {
  sesion: Sesion;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const config = ROLES[sesion.rol];
  const iniciales = sesion.nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  const NavContenido = (
    <>
      <div className="px-4 py-5">
        <Marca className="text-lg" />
      </div>
      <div className="px-4 pb-2">
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
          {config.label}
        </span>
      </div>
      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {config.nav.map((item) => {
          const activo = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                activo
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase">
            {iniciales}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{sesion.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">{sesion.email}</p>
          </div>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        {NavContenido}
      </aside>

      {abierto ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-sidebar">
            <button
              onClick={() => setAbierto(false)}
              className="absolute right-3 top-4 text-muted-foreground"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
            {NavContenido}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-6">
          <button className="lg:hidden" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <Menu className="size-5" />
          </button>
          <span className="ml-auto text-sm text-muted-foreground">
            {sesion.tiendaId ? "Tienda asignada" : "Alcance nacional"}
          </span>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
