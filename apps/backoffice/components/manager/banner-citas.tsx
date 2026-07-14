// Banner recordatorio de citas próximas (48 h) — server component: consulta
// la fachada del core y renderiza un marquee CSS puro (cero JS). Visible en
// TODOS los apartados del manager (lo inyecta su layout vía PanelShell).

import { CalendarClock } from "lucide-react";
import { agendaService } from "@/lib/core-server";

const CUANDO = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export async function BannerCitas({ tiendaId }: { tiendaId: string }) {
  // próximas citas SIN ventana: una cita a 3 días también merece recordarse
  // (feedback de Julián: creó una y el corte de 48h se la escondía)
  const ahora = new Date();
  const proximas = await agendaService().citasProximas(tiendaId, ahora.toISOString(), 6);

  if (proximas.length === 0) return null;

  const items = proximas.map(
    (c) =>
      `${c.tipo === "visita" ? "📍" : "👥"} ${CUANDO.format(new Date(c.fechaHoraIso))} — ${c.titulo}`,
  );

  return (
    <div className="flex items-center gap-2 overflow-hidden border-b border-border bg-primary/5 px-4 py-1.5 text-sm">
      <CalendarClock className="size-4 shrink-0 text-primary" />
      {/* el marquee va ABSOLUTE: fuera del flujo no aporta min-content, así
          su w-max jamás propaga ancho al main y no crea scroll horizontal
          (bug reportado por Julián en viewports ≤1366px) */}
      <div className="relative h-6 min-w-0 flex-1 overflow-hidden">
        {/* contenido duplicado: el loop del marquee es continuo, sin salto */}
        <div className="animar-marquee absolute inset-y-0 left-0 flex w-max items-center gap-12 whitespace-nowrap">
          {[0, 1].map((copia) => (
            <span key={copia} className="flex gap-12" aria-hidden={copia === 1}>
              {items.map((texto, i) => (
                <span key={i} className="text-muted-foreground">
                  {texto}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
