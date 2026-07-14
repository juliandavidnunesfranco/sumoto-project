// Tabla de solicitudes reutilizable (vendedor: "Mis solicitudes"; manager:
// "Resumen de tienda") — server component puro, recibe la página ya resuelta
// contra la fachada del core. Acciones por fila: ver en el wizard, llamar,
// WhatsApp y (solo manager) reasignar vendedor.

import Link from "next/link";
import { Eye, Phone, MessageCircle, UserCog } from "lucide-react";
import type { SolicitudReciente } from "@sumo/core";
import { pesos } from "@/lib/format";
import { EstadoBadge } from "@/components/panel/ui";

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" });

const ESTILO_ACCION =
  "rounded-lg border border-transparent p-2 text-muted-foreground transition-colors duration-150 hover:border-black hover:text-foreground";

export function TablaSolicitudes({
  solicitudes,
  conReasignar = false,
  conWizard = true,
  conVendedor = false,
}: {
  solicitudes: SolicitudReciente[];
  /** Acción de gestión del manager (por ahora visual: flujo por definir). */
  conReasignar?: boolean;
  /** El wizard solo es navegable por vendedor/manager (proxy lo gatea). */
  conWizard?: boolean;
  /** Columna "Vendedor" (vista del manager, estilo v0). */
  conVendedor?: boolean;
}) {
  if (solicitudes.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aún no hay solicitudes.
        {conWizard ? (
          <>
            {" "}
            <Link href="/solicitudes/nueva" className="font-medium text-primary hover:underline">
              Crea la primera
            </Link>
            .
          </>
        ) : null}
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr className="border-b border-border">
          <th className="pb-3 pr-4 font-medium">Solicitud</th>
          <th className="pb-3 pr-4 font-medium">Cliente</th>
          <th className="pb-3 pr-4 font-medium">Moto</th>
          {conVendedor ? <th className="pb-3 pr-4 font-medium">Vendedor</th> : null}
          <th className="pb-3 pr-4 font-medium">Valor moto</th>
          <th className="pb-3 pr-4 font-medium">Cuota est.</th>
          <th className="pb-3 pr-4 font-medium">Decisión</th>
          <th className="pb-3 pr-4 font-medium">Estado</th>
          <th className="pb-3 pr-4 font-medium">Fecha</th>
          <th className="pb-3 text-right font-medium">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {solicitudes.map((s) => (
          <tr key={s.solicitud_id}>
            {/* id corto: suficiente para distinguir casos del mismo cliente */}
            <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
              #{s.solicitud_id.slice(0, 8)}
            </td>
            <td className="py-3 pr-4">
              <p className="font-medium">{s.cliente_nombre ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {s.cliente_cedula ? `CC ${s.cliente_cedula}` : "—"}
              </p>
            </td>
            <td className="py-3 pr-4 text-muted-foreground">{s.moto_nombre ?? "—"}</td>
            {conVendedor ? (
              <td className="py-3 pr-4 text-muted-foreground">{s.vendedor_nombre ?? "—"}</td>
            ) : null}
            <td className="py-3 pr-4 tabular-nums">{pesos(s.valor_moto_centavos)}</td>
            <td className="py-3 pr-4 tabular-nums">
              {s.cuota_estimada_centavos ? pesos(s.cuota_estimada_centavos) : "—"}
            </td>
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
                {conWizard ? (
                  <Link
                    href={`/solicitudes/nueva?cedula=${s.cliente_cedula ?? ""}&solicitudId=${s.solicitud_id}&paso=decision`}
                    title="Ver en el wizard"
                    className={ESTILO_ACCION}
                  >
                    <Eye className="size-4" />
                  </Link>
                ) : null}
                {s.cliente_telefono ? (
                  <>
                    <a
                      href={`tel:+57${s.cliente_telefono}`}
                      title={`Llamar al ${s.cliente_telefono}`}
                      className={ESTILO_ACCION}
                    >
                      <Phone className="size-4" />
                    </a>
                    <a
                      href={`https://wa.me/57${s.cliente_telefono}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Escribir por WhatsApp"
                      className={ESTILO_ACCION}
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  </>
                ) : null}
                {conReasignar ? (
                  <button
                    type="button"
                    disabled
                    title="Reasignar vendedor (próximamente)"
                    className="rounded-lg border border-transparent p-2 text-muted-foreground opacity-50"
                  >
                    <UserCog className="size-4" />
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
