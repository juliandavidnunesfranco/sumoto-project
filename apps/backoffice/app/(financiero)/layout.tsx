import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { originacionService } from "@/lib/core-server";
import { PanelShell, type SubNav } from "@/components/panel/panel-shell";

export default async function FinancieroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) redirect("/login?denegado=1");

  // Submenú de productos bajo "Políticas de crédito": la lista sale de la
  // fachada del core (nunca Supabase directo) y se refresca en cada request
  // — crear un producto redirige y el layout se re-renderiza con él.
  const productos = await originacionService().listarProductosActivos();
  const subnav: SubNav = {
    padre: "/politicas",
    items: [
      ...productos.map((p) => ({
        label: p.nombre,
        href: `/politicas?productoId=${p.id}`,
      })),
      { label: "+ Nuevo producto", href: "/politicas?nuevo=1" },
    ],
  };

  return (
    <PanelShell sesion={sesion} subnav={subnav}>
      {children}
    </PanelShell>
  );
}
