// Config de navegación por rol — presentación pura, sin lógica de negocio.
// "políticas" no es un rol aparte: sus pantallas viven bajo financiero.

import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  FilePlus2,
  LayoutDashboard,
  ScrollText,
  Store,
  Wallet,
} from "lucide-react";
import type { Rol } from "@sumo/core";

export interface RolConfig {
  label: string;
  descripcion: string;
  nav: { label: string; href: string; icon: LucideIcon }[];
}

export const ROLES: Record<Rol, RolConfig> = {
  vendedor: {
    label: "Vendedor",
    descripcion: "Origina solicitudes de crédito en el punto de venta.",
    nav: [{ label: "Nueva solicitud", href: "/solicitudes/nueva", icon: FilePlus2 }],
  },
  manager: {
    label: "Manager de tienda",
    descripcion: "Supervisa la colocación y el equipo de vendedores.",
    nav: [
      { label: "Resumen de tienda", href: "/tienda", icon: Store },
      { label: "Nueva solicitud", href: "/solicitudes/nueva", icon: FilePlus2 },
    ],
  },
  financiero: {
    label: "Financiero",
    descripcion: "Vigila riesgo, cartera y define las políticas de crédito.",
    nav: [
      { label: "Cartera y riesgo", href: "/cartera", icon: Wallet },
      { label: "Políticas de crédito", href: "/politicas", icon: ScrollText },
    ],
  },
  contable: {
    label: "Contable",
    descripcion: "Concilia recaudos, intereses y asientos contables.",
    nav: [{ label: "Contabilidad", href: "/contabilidad", icon: Calculator }],
  },
  ceo: {
    label: "CEO",
    descripcion: "Vista ejecutiva general del negocio.",
    nav: [{ label: "Vista general", href: "/ceo", icon: LayoutDashboard }],
  },
};
