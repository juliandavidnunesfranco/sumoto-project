// Config de navegación por rol — presentación pura, sin lógica de negocio.
// "políticas" no es un rol aparte: sus pantallas viven bajo financiero.

import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  ScrollText,
  Store,
  UserSearch,
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
    nav: [
      { label: "Nueva solicitud", href: "/solicitudes/nueva", icon: FilePlus2 },
      { label: "Mis solicitudes", href: "/solicitudes", icon: ClipboardList },
      { label: "Buscar cliente", href: "/buscar", icon: UserSearch },
    ],
  },
  manager: {
    label: "Manager de tienda",
    descripcion: "Supervisa la colocación y el equipo de vendedores.",
    nav: [
      { label: "Hoy", href: "/hoy", icon: CalendarCheck },
      { label: "Resumen de tienda", href: "/tienda", icon: Store },
      { label: "Calendario", href: "/calendario", icon: CalendarDays },
      { label: "Nueva solicitud", href: "/solicitudes/nueva", icon: FilePlus2 },
      { label: "Buscar cliente", href: "/buscar", icon: UserSearch },
    ],
  },
  financiero: {
    label: "Financiero",
    descripcion: "Vigila riesgo, cartera y define las políticas de crédito.",
    nav: [
      { label: "Cartera y riesgo", href: "/cartera", icon: Wallet },
      { label: "Políticas de crédito", href: "/politicas", icon: ScrollText },
      { label: "Buscar cliente", href: "/buscar", icon: UserSearch },
    ],
  },
  contable: {
    label: "Contable",
    descripcion: "Concilia recaudos, intereses y asientos contables.",
    nav: [
      { label: "Contabilidad", href: "/contabilidad", icon: Calculator },
      { label: "Buscar cliente", href: "/buscar", icon: UserSearch },
    ],
  },
  ceo: {
    label: "CEO",
    descripcion: "Vista ejecutiva general del negocio.",
    nav: [
      { label: "Vista general", href: "/ceo", icon: LayoutDashboard },
      { label: "Buscar cliente", href: "/buscar", icon: UserSearch },
    ],
  },
};
