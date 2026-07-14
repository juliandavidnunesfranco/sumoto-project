// Pantallas COMPARTIDAS por todos los roles (buscar cliente, casos del
// cliente). Segunda puerta igual que los grupos por rol: exigirRol — el
// alcance de DATOS (tienda vs nacional) lo decide cada página según el rol.

import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { PanelShell } from "@/components/panel/panel-shell";

export default async function CompartidoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirRol(["vendedor", "manager", "financiero", "contable", "ceo"]);
  if (sesion instanceof Response) redirect("/login?denegado=1");
  return <PanelShell sesion={sesion}>{children}</PanelShell>;
}
