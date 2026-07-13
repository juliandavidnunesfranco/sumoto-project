import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { PanelShell } from "@/components/panel/panel-shell";

export default async function ContableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirRol(["contable"]);
  if (sesion instanceof Response) redirect("/login?denegado=1");
  return <PanelShell sesion={sesion}>{children}</PanelShell>;
}
