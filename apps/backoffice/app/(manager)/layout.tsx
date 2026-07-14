import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { PanelShell } from "@/components/panel/panel-shell";
import { BannerCitas } from "@/components/manager/banner-citas";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirRol(["manager"]);
  if (sesion instanceof Response) redirect("/login?denegado=1");
  return (
    <PanelShell
      sesion={sesion}
      // recordatorio de citas próximas, visible en TODOS los apartados
      banner={sesion.tiendaId ? <BannerCitas tiendaId={sesion.tiendaId} /> : undefined}
    >
      {children}
    </PanelShell>
  );
}
