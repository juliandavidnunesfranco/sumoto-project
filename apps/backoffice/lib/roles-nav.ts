// Config de navegación por rol — presentación pura, sin lógica de negocio.
// "políticas" no es un rol aparte: sus pantallas viven bajo financiero.

import type { Rol } from "@sumo/core";

export interface RolConfig {
  label: string;
  descripcion: string;
  nav: { label: string; href: string }[];
}

export const ROLES: Record<Rol, RolConfig> = {
  vendedor: {
    label: "Vendedor",
    descripcion: "Origina solicitudes de crédito en el punto de venta.",
    nav: [{ label: "Nueva solicitud", href: "/solicitudes/nueva" }],
  },
  manager: {
    label: "Manager de tienda",
    descripcion: "Supervisa la colocación y el equipo de vendedores.",
    nav: [
      { label: "Resumen de tienda", href: "/tienda" },
      { label: "Nueva solicitud", href: "/solicitudes/nueva" },
    ],
  },
  financiero: {
    label: "Financiero",
    descripcion: "Vigila riesgo, cartera y define las políticas de crédito.",
    nav: [
      { label: "Cartera y riesgo", href: "/cartera" },
      { label: "Políticas de crédito", href: "/politicas" },
    ],
  },
  contable: {
    label: "Contable",
    descripcion: "Concilia recaudos, intereses y asientos contables.",
    nav: [{ label: "Contabilidad", href: "/contabilidad" }],
  },
  ceo: {
    label: "CEO",
    descripcion: "Vista ejecutiva general del negocio.",
    nav: [{ label: "Vista general", href: "/ceo" }],
  },
};
