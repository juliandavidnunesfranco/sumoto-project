import { cn } from "@/lib/cn";

export function Marca({ className, sub }: { className?: string; sub?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2 font-black tracking-tight", className)}>
      <span>
        SU<span className="text-primary">MOTO</span>
      </span>
      {sub ? <span className="text-sm font-normal text-muted-foreground">· {sub}</span> : null}
    </span>
  );
}
