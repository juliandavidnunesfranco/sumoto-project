// Tarjeta de resultado de la decisión — extraída de page.tsx para mantenerlo
// pequeño (una responsabilidad por archivo). Puro presentacional: recibe la
// Decision ya calculada por el motor real, no decide nada.

import type { Decision } from "@sumo/core";
import { CheckCircle2, XCircle } from "lucide-react";
import { pesos } from "@/lib/format";
import { GaugeScore } from "@/components/vendedor/gauge-score";
import { cn } from "@/lib/cn";

const ESTILOS_RESULTADO: Record<string, string> = {
  APROBADO: "border-emerald-500/50 bg-emerald-500/10",
  NEGADO: "border-destructive/50 bg-destructive/10",
  REVISION_MANUAL: "border-amber-500/50 bg-amber-500/10",
};
const COLOR_TITULO: Record<string, string> = {
  APROBADO: "text-emerald-400",
  NEGADO: "text-destructive",
  REVISION_MANUAL: "text-amber-400",
};
const TITULOS: Record<string, string> = {
  APROBADO: "Aprobado",
  NEGADO: "Negado",
  REVISION_MANUAL: "Revisión manual",
};

export function TarjetaDecision({ decision }: { decision: Decision }) {
  return (
    <div className={cn("rounded-2xl border-2 p-6", ESTILOS_RESULTADO[decision.resultado])}>
      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div className="flex justify-center">
          <GaugeScore score={decision.score} />
        </div>
        <div>
          <p className={cn("text-3xl font-black", COLOR_TITULO[decision.resultado])}>
            {TITULOS[decision.resultado]}
          </p>
          {decision.cuotaEstimadaCentavos > 0 && (
            <p className="mt-1 text-lg">
              Cuota mensual estimada: <strong>{pesos(decision.cuotaEstimadaCentavos)}</strong>
            </p>
          )}
          <ul className="mt-4 space-y-1.5 text-sm">
            {decision.razones.map((r) => (
              <li key={r} className="flex items-start gap-2">
                {decision.resultado === "NEGADO" ? (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                )}
                <span className="text-muted-foreground">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
