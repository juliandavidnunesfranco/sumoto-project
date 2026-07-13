import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { PanelShell } from "@/components/panel/panel-shell";

export default async function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return <PanelShell sesion={sesion}>{children}</PanelShell>;
}
