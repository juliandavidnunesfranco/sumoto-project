// "Mis solicitudes" — 100% SSR sobre la fachada de reporteria, paginada.
// Alcance por ROL: el vendedor ve las que ÉL originó (creado_por); el
// manager ve las de su tienda. Acciones por fila: retomar en el wizard,
// llamar y escribir al cliente.

import Link from "next/link";
import { Eye, Phone, MessageCircle } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { reporteriaService } from "@/lib/core-server";
import { pesos } from "@/lib/format";
import { EstadoBadge, PageHeader, Tarjeta } from "@/components/panel/ui";
import { SelectorPorPagina } from "@/components/shared/selector-por-pagina";
import { Paginacion } from "@/components/shared/paginacion";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" });

export default async function MisSolicitudes({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string; porPagina?: string }>;
}) {
  const params = await searchParams;
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const porPagina = [10, 20, 40, 50].includes(Number(params.porPagina))
    ? Number(params.porPagina)
    : 10;

  const sesion = await obtenerSesion();

  // vendedor → sus propias solicitudes; manager → las de su tienda.
  // Sin tienda asignada = estado anómalo: vacío, nunca alcance nacional.
  const { items: solicitudes, total } = sesion?.tiendaId
    ? await reporteriaService().solicitudesPaginadas({
        ...(sesion.rol === "vendedor"
          ? { creadoPor: sesion.userId }
          : { tiendaId: sesion.tiendaId }),
        pagina,
        porPagina,
      })
    : { items: [], total: 0 };

  function hrefPagina(destino: number): string {
    const qs = new URLSearchParams();
    qs.set("porPagina", String(porPagina));
    qs.set("pagina", String(destino));
    return `/solicitudes?${qs.toString()}`;
  }

  return (
    <div>
      <PageHeader
        titulo="Mis solicitudes"
        descripcion={
          sesion?.rol === "manager"
            ? "Solicitudes de tu tienda: revisa la decisión o contacta al cliente."
            : "Solicitudes que originaste: retómalas, revisa la decisión o contacta al cliente."
        }
      />

      <Tarjeta className="overflow-x-auto">
        {solicitudes.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay solicitudes.{" "}
            <Link href="/solicitudes/nueva" className="font-medium text-primary hover:underline">
              Crea la primera
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">Valor moto</th>
                <th className="pb-3 pr-4 font-medium">Cuota est.</th>
                <th className="pb-3 pr-4 font-medium">Plazo</th>
                <th className="pb-3 pr-4 font-medium">Decisión</th>
                <th className="pb-3 pr-4 font-medium">Estado</th>
                <th className="pb-3 pr-4 font-medium">Fecha</th>
                <th className="pb-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {solicitudes.map((s) => (
                <tr key={s.solicitud_id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium">{s.cliente_nombre ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.cliente_cedula ? `CC ${s.cliente_cedula}` : "—"}
                    </p>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{pesos(s.valor_moto_centavos)}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {s.cuota_estimada_centavos ? pesos(s.cuota_estimada_centavos) : "—"}
                  </td>
                  <td className="py-3 pr-4">{s.plazo_meses} m</td>
                  <td className="py-3 pr-4">
                    {s.decision_resultado ? <EstadoBadge estado={s.decision_resultado} /> : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <EstadoBadge estado={s.estado.toUpperCase()} />
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {FECHA.format(new Date(s.creado_en))}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/solicitudes/nueva?cedula=${s.cliente_cedula ?? ""}&solicitudId=${s.solicitud_id}&paso=decision`}
                        title="Ver en el wizard"
                        className="rounded-lg border border-transparent p-2 text-muted-foreground transition-colors duration-150 hover:border-black hover:text-foreground"
                      >
                        <Eye className="size-4" />
                      </Link>
                      {s.cliente_telefono ? (
                        <>
                          <a
                            href={`tel:+57${s.cliente_telefono}`}
                            title={`Llamar al ${s.cliente_telefono}`}
                            className="rounded-lg border border-transparent p-2 text-muted-foreground transition-colors duration-150 hover:border-black hover:text-foreground"
                          >
                            <Phone className="size-4" />
                          </a>
                          <a
                            href={`https://wa.me/57${s.cliente_telefono}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Escribir por WhatsApp"
                            className="rounded-lg border border-transparent p-2 text-muted-foreground transition-colors duration-150 hover:border-black hover:text-foreground"
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <SelectorPorPagina param="porPagina" resetParam="pagina" />
          <Paginacion
            pagina={pagina}
            porPagina={porPagina}
            total={total}
            hrefPagina={hrefPagina}
            sustantivo={["solicitud", "solicitudes"]}
          />
        </div>
      </Tarjeta>
    </div>
  );
}
