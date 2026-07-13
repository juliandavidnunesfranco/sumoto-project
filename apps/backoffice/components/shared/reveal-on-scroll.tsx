"use client";

// Entrada al hacer scroll (IntersectionObserver): la única razón para que este
// componente sea client — el resto de la landing es SSR puro. Se dispara una
// vez y no se revierte al volver a desplazarse hacia arriba.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function RevealOnScroll({
  children,
  retrasoMs = 0,
  className,
}: {
  children: React.ReactNode;
  retrasoMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${retrasoMs}ms` : "0ms" }}
      className={cn(
        "transition-all duration-500 ease-[cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100",
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
