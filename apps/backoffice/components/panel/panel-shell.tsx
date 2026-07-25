"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Sesion } from "@/lib/auth";
import { ROLES } from "@/lib/roles-nav";
import { cerrarSesion } from "@/app/(auth)/login/actions";
import { cn } from "@/lib/cn";
import { InputBusqueda } from "@/components/shared/input-busqueda";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

/** Submenú dinámico bajo un ítem del nav (ej. productos bajo Políticas). */
export interface SubNav {
  /** href del ítem padre del nav bajo el que cuelga el submenú. */
  padre: string;
  items: { label: string; href: string }[];
}

// Mismo lenguaje de hover que home/login: borde inferior siempre visible (pero
// transparente en reposo), se completa a un marco entero en hover, animando
// el COLOR del borde (no su ancho, eso no se puede transicionar suave).
const enlaceEstiloSuzuki =
  "rounded-none border border-transparent p-2 font-headline text-sm font-bold text-foreground transition-colors duration-200 hover:border-black hover:bg-transparent hover:text-foreground data-active:border-black data-active:bg-transparent data-active:font-bold data-active:text-foreground";

export function PanelShell({
  sesion,
  children,
  banner,
  subnav,
}: {
  sesion: Sesion;
  children: React.ReactNode;
  /** Franja bajo el header (ej. recordatorio de citas del manager). */
  banner?: React.ReactNode;
  /** Submenú dinámico (ej. productos de crédito bajo Políticas). */
  subnav?: SubNav;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // URL vigente con query, para marcar activo un ítem del submenú (los
  // productos se distinguen por searchParams, no por pathname)
  const urlActual = searchParams.size > 0 ? `${pathname}?${searchParams}` : pathname;
  const config = ROLES[sesion.rol];
  const iniciales = sesion.nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-4 py-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
          <div className="group-data-[collapsible=icon]:hidden">
            <Image
              src="/motos/cropped-Logotipo-Su-Moto-sa-PNG-02-2048x561.png"
              width={160}
              height={44}
              alt="SUMOTO"
            />
            <span className="mt-2 w-fit px-2.5 py-1 text-xs font-medium font-heading">
              {config.label}
            </span>
          </div>
          <Image
            src="/motos/sumoto-s-icon-128.png"
            width={28}
            height={28}
            alt="SUMOTO"
            className="hidden group-data-[collapsible=icon]:block"
          />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {config.nav.map((item) => {
                const activo = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={activo}
                      tooltip={item.label}
                      className={enlaceEstiloSuzuki}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      {item.label}
                    </SidebarMenuButton>
                    {subnav && subnav.padre === item.href && subnav.items.length > 0 ? (
                      <SidebarMenuSub className="mt-1 space-y-1">
                        {subnav.items.map((sub) => (
                          <SidebarMenuSubItem key={sub.href}>
                            <SidebarMenuSubButton
                              isActive={urlActual === sub.href}
                              className={cn(enlaceEstiloSuzuki, "h-auto")}
                              render={<Link href={sub.href} />}
                            >
                              {sub.label}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase">
              {iniciales}
            </span>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{sesion.nombre}</p>
              <p className="truncate text-xs text-muted-foreground">{sesion.email}</p>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className={cn(
                "mt-1 flex w-full items-center gap-2 group-data-[collapsible=icon]:justify-center",
                enlaceEstiloSuzuki,
              )}
            >
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">Cerrar sesión</span>
            </button>
          </form>
        </SidebarFooter>
      </Sidebar>

      {/* min-w-0: un flex item sin él no puede encogerse por debajo de su
          min-content y el contenido ancho (tablas, marquee) crea scroll
          horizontal en TODA la página en viewports angostos */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-6">
          <SidebarTrigger />
          <InputBusqueda
            param="q"
            ruta="/buscar"
            placeholder="Buscar cliente por nombre o cédula…"
            className="ml-auto w-full max-w-xs"
          />
        </header>

        {banner}

        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
