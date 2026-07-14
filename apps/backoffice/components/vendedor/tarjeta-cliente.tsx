// Sub-tarjeta del paso 1: cliente + reporte de riesgo, fiel al diseño de
// referencia (gauge más grande, nombre en font-headline, badges de
// cumplimiento, vectores de pago del buró). Puro presentacional.

import { AlertTriangle, CheckCircle2, MapPin, XCircle } from "lucide-react";
import type { Cliente } from "@sumo/core";
import type { ReporteRiesgo } from "@sumo/core";
import { edadDesde, pesos } from "@/lib/format";
import { GaugeScore } from "@/components/vendedor/gauge-score";
import { cn } from "@/lib/cn";

function Badge({
  tono,
  icon: Icon,
  children,
}: {
  tono: "verde" | "ambar" | "gris";
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tono === "verde" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        tono === "ambar" && "border-amber-500/30 bg-amber-500/10 text-amber-400",
        tono === "gris" && "border-border bg-secondary text-muted-foreground",
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function TarjetaCliente({
  cliente,
  reporteRiesgo,
}: {
  cliente: Cliente;
  reporteRiesgo: ReporteRiesgo | null;
}) {
  const edad = cliente.fechaNacimiento ? edadDesde(cliente.fechaNacimiento) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-6 sm:grid-cols-[240px_1fr] sm:items-start">
        <div className="flex justify-center sm:justify-start">
          {reporteRiesgo ? (
            <GaugeScore score={reporteRiesgo.score} />
          ) : (
            <p className="text-sm text-amber-400">Sin score disponible</p>
          )}
        </div>

        <div>
          <h3 className="text-center font-headline text-2xl font-bold sm:text-left">
            {cliente.nombres} {cliente.apellidos}
          </h3>
          <p className="mt-1 text-center text-sm text-muted-foreground sm:text-left">
            CC {cliente.cedula}
            {edad !== null ? ` · ${edad} años` : ""}
            {cliente.ciudad ? ` · ${cliente.ciudad}` : ""}
          </p>

          {reporteRiesgo && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {reporteRiesgo.reportesNegativos ? (
                <Badge tono="ambar" icon={XCircle}>
                  Con reportes negativos
                </Badge>
              ) : (
                <Badge tono="verde" icon={CheckCircle2}>
                  Sin reportes negativos
                </Badge>
              )}
              {cliente.geoCoincide === false ? (
                <Badge tono="ambar" icon={AlertTriangle}>
                  Geo no coincide
                </Badge>
              ) : (
                <Badge tono="verde" icon={CheckCircle2}>
                  Geo coincide
                </Badge>
              )}
            </div>
          )}

          {(cliente.direccion || cliente.estrato) && (
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge tono="gris" icon={MapPin}>
                {cliente.direccion}
                {cliente.estrato ? ` · estrato ${cliente.estrato}` : ""}
              </Badge>
            </div>
          )}

          {reporteRiesgo && reporteRiesgo.vectoresPago.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Vectores de pago (buró)
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {reporteRiesgo.vectoresPago.map((v, i) => (
                  <li key={`${v.entidad}-${i}`} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {v.entidad} · {v.tipoProducto}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-medium",
                        v.diasMora === 0
                          ? "text-emerald-400"
                          : v.diasMora < 60
                            ? "text-amber-400"
                            : "text-destructive",
                      )}
                    >
                      {pesos(v.saldoCentavos)} · {v.diasMora}d mora
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
