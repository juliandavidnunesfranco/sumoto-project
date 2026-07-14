// Resumen de tienda (manager): server component sobre ReporteriaService,
// filtrado a la tienda del usuario. Datos reales — cero mocks.

import { obtenerSesion } from "@/lib/auth";
import { reporteriaService } from "@/lib/core-server";
import { pesos, pesosCompacto } from "@/lib/format";
import { EstadoBadge, Kpi, PageHeader, Tarjeta } from "@/components/panel/ui";

export const dynamic = "force-dynamic";

export default async function TiendaPage() {
  const sesion = await obtenerSesion();
  const svc = reporteriaService();

  // manager sin tienda asignada = estado anómalo: lista vacía, nunca alcance
  // nacional (omitir tiendaId traería solicitudes de TODAS las tiendas)
  const [porTienda, solicitudes] = await Promise.all([
    svc.carteraPorTienda(),
    sesion?.tiendaId
      ? svc.solicitudesRecientes({ tiendaId: sesion.tiendaId, limite: 15 })
      : Promise.resolve([]),
  ]);
  const miTienda = porTienda.find((t) => t.tienda_id === sesion?.tiendaId);
  const aprobadas = solicitudes.filter((s) => s.decision_resultado === "APROBADO").length;

  return (
    <div>
      <PageHeader
        titulo="Resumen de tienda"
        descripcion={miTienda ? miTienda.tienda_nombre : "Colocación y solicitudes recientes."}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi titulo="Créditos activos" valor={String(miTienda?.creditos_activos ?? 0)} acento="primary" />
        <Kpi titulo="Cartera de la tienda" valor={pesosCompacto(miTienda?.capital_total_centavos ?? 0)} />
        <Kpi titulo="Solicitudes recientes" valor={String(solicitudes.length)} />
        <Kpi titulo="Aprobadas" valor={String(aprobadas)} acento="emerald" />
      </div>

      <Tarjeta className="mt-6 overflow-x-auto">
        <h2 className="font-semibold">Solicitudes recientes</h2>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 text-right font-medium">Valor moto</th>
              <th className="py-2 text-right font-medium">Cuota</th>
              <th className="py-2 text-right font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {solicitudes.map((s) => (
              <tr key={s.solicitud_id} className="border-t border-border">
                <td className="py-2">{s.cliente_nombre ?? "—"}</td>
                <td className="py-2 text-right">{pesos(s.valor_moto_centavos)}</td>
                <td className="py-2 text-right">
                  {s.cuota_estimada_centavos ? pesos(s.cuota_estimada_centavos) : "—"}
                </td>
                <td className="py-2 text-right">
                  <EstadoBadge estado={s.decision_resultado ?? s.estado} />
                </td>
              </tr>
            ))}
            {solicitudes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Sin solicitudes todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}
