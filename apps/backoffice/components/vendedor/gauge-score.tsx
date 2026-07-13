// Medidor semicircular de score Experian (150–950), en SVG puro.

const MIN = 150;
const MAX = 950;

function bandas(score: number) {
  if (score >= 700) return { label: "Bajo riesgo", color: "text-emerald-400", stroke: "#34d399" };
  if (score >= 550) return { label: "Riesgo medio", color: "text-amber-400", stroke: "#fbbf24" };
  return { label: "Alto riesgo", color: "text-destructive", stroke: "#ef4444" };
}

export function GaugeScore({ score }: { score: number }) {
  const pct = Math.min(1, Math.max(0, (score - MIN) / (MAX - MIN)));
  const { label, color, stroke } = bandas(score);

  const r = 80;
  const largo = Math.PI * r;
  const offset = largo * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth={14}
          strokeLinecap="round"
          className="text-secondary"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={stroke}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="-mt-6 flex flex-col items-center">
        <span className="text-3xl font-black tabular-nums">{score}</span>
        <span className={`text-xs font-medium ${color}`}>{label}</span>
      </div>
    </div>
  );
}
