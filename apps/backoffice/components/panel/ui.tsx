import { cn } from "@/lib/cn";

export function PageHeader({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-6xl font-bold font-heading tracking-tight">{titulo}</h1>
        {descripcion ? <p className="mt-1 text-base text-muted-foreground">{descripcion}</p> : null}
      </div>
      {accion}
    </div>
  );
}

export function Tarjeta({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("rounded-2xl border border-border bg-card p-6", className)}>{children}</div>;
}

export function Kpi({
  titulo,
  valor,
  nota,
  acento,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  acento?: "primary" | "amber" | "emerald";
}) {
  const color =
    acento === "primary"
      ? "text-primary"
      : acento === "amber"
        ? "text-amber-400"
        : acento === "emerald"
          ? "text-emerald-400"
          : "text-foreground";
  return (
    <Tarjeta className="p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums", color)}>{valor}</p>
      {nota ? <p className="mt-1 text-xs text-muted-foreground">{nota}</p> : null}
    </Tarjeta>
  );
}

const ESTADOS: Record<string, string> = {
  APROBADO: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  NEGADO: "border-destructive/40 bg-destructive/10 text-destructive",
  REVISION_MANUAL: "border-amber-500/40 bg-amber-500/10 text-amber-400",
};

export function EstadoBadge({ estado }: { estado: string }) {
  const etiqueta = estado === "REVISION_MANUAL" ? "Revisión" : estado.charAt(0) + estado.slice(1).toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        ESTADOS[estado] ?? "border-border bg-secondary text-muted-foreground",
      )}
    >
      {etiqueta}
    </span>
  );
}

export function BarraHorizontal({
  etiqueta,
  valor,
  max,
  detalle,
  color = "bg-primary",
}: {
  etiqueta: string;
  valor: number;
  max: number;
  detalle: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-sm text-muted-foreground">{etiqueta}</span>
      <div className="h-6 flex-1 overflow-hidden rounded bg-secondary">
        <div className={cn("h-full rounded", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-36 shrink-0 text-right text-sm tabular-nums">{detalle}</span>
    </div>
  );
}

/** Mini gráfico de columnas en CSS puro (SSR, sin librerías). */
export function ColumnasMensuales({
  datos,
  formato,
}: {
  datos: { etiqueta: string; valor: number }[];
  formato: (v: number) => string;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height: 180 }}>
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-[10px] tabular-nums text-muted-foreground">{formato(d.valor)}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary/80"
              style={{ height: `${Math.round((d.valor / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{d.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}
