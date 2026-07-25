// Verificación pre-desembolso — etapa de otorgamiento del expediente de
// crédito (práctica estándar de entidades vigiladas por la Superfinanciera:
// SARC Cap. II de la Circular Básica Contable + Ley 1266/2008 de habeas data
// + SARLAFT). El desembolso NO procede sin el expediente completo:
// - Ítems OBLIGATORIOS: bloquean el desembolso mientras falten.
// - Ítems PONDERADOS: suman puntos; se exige un mínimo de completitud.
// TS puro (regla 4): el catálogo y la evaluación viven aquí; la persistencia
// de las marcas es asunto de infraestructura.

export interface ItemVerificacion {
  codigo: string;
  etiqueta: string;
  descripcion: string;
  obligatorio: boolean;
  /** Puntos que aporta al índice de completitud (0 en los obligatorios: bloquean, no puntúan). */
  puntos: number;
}

/** Puntaje ponderado mínimo para desembolsar (además de TODOS los obligatorios). */
export const PUNTAJE_MINIMO_VERIFICACION = 70;

// Catálogo demo, parametrizable a futuro por producto (como reglas_decision).
// Los puntos y el umbral son propuesta de trabajo — los define el financiero.
export const CHECKLIST_DESEMBOLSO: readonly ItemVerificacion[] = [
  {
    codigo: "identidad-verificada",
    etiqueta: "Identidad verificada",
    descripcion:
      "El documento de identidad coincide con el solicitante (lectura de cédula / validación).",
    obligatorio: true,
    puntos: 0,
  },
  {
    codigo: "autorizacion-centrales",
    etiqueta: "Autorización de consulta a centrales",
    descripcion:
      "Autorización firmada de consulta y reporte a centrales de riesgo (Ley 1266 de 2008).",
    obligatorio: true,
    puntos: 0,
  },
  {
    codigo: "sarlaft",
    etiqueta: "Conocimiento del cliente (SARLAFT)",
    descripcion:
      "Formulario de vinculación diligenciado y contrastado contra listas restrictivas.",
    obligatorio: true,
    puntos: 0,
  },
  {
    codigo: "pagare-firmado",
    etiqueta: "Pagaré y carta de instrucciones",
    descripcion: "Pagaré en blanco y carta de instrucciones firmados por el deudor.",
    obligatorio: true,
    puntos: 0,
  },
  {
    codigo: "reporte-buro",
    etiqueta: "Reporte de buró archivado",
    descripcion: "El reporte de la central de riesgo queda guardado en el expediente.",
    obligatorio: false,
    puntos: 20,
  },
  {
    codigo: "ingresos-soportados",
    etiqueta: "Soportes de ingresos",
    descripcion:
      "Desprendibles, certificado laboral o extractos que respaldan el ingreso declarado.",
    obligatorio: false,
    puntos: 30,
  },
  {
    codigo: "verificacion-laboral",
    etiqueta: "Verificación laboral telefónica",
    descripcion: "Se confirmó el empleo y la antigüedad directamente con el empleador.",
    obligatorio: false,
    puntos: 20,
  },
  {
    codigo: "referencias",
    etiqueta: "Referencias verificadas",
    descripcion: "Referencias personales o familiares contactadas.",
    obligatorio: false,
    puntos: 10,
  },
  {
    codigo: "prenda-inscrita",
    etiqueta: "Prenda de la moto constituida",
    descripcion: "Garantía prendaria sin tenencia sobre el vehículo financiado.",
    obligatorio: false,
    puntos: 20,
  },
];

export function esCodigoDeChecklist(codigo: string): boolean {
  return CHECKLIST_DESEMBOLSO.some((i) => i.codigo === codigo);
}

export interface EstadoVerificacion {
  completa: boolean;
  puntaje: number;
  puntajeMaximo: number;
  puntajeMinimo: number;
  /** Etiquetas de los obligatorios sin marcar. */
  faltantesObligatorios: string[];
  /** Explicabilidad, mismo espíritu del motor de decisión: siempre se sabe POR QUÉ. */
  razones: string[];
}

/**
 * Evalúa el estado del expediente a partir de los códigos marcados.
 * Códigos desconocidos se IGNORAN (el catálogo es la whitelist — misma
 * doctrina que los mapas de filtros de reporteria).
 */
export function evaluarVerificacion(marcados: readonly string[]): EstadoVerificacion {
  const set = new Set(marcados);

  const faltantesObligatorios = CHECKLIST_DESEMBOLSO.filter(
    (i) => i.obligatorio && !set.has(i.codigo),
  ).map((i) => i.etiqueta);

  const puntaje = CHECKLIST_DESEMBOLSO.filter(
    (i) => !i.obligatorio && set.has(i.codigo),
  ).reduce((suma, i) => suma + i.puntos, 0);

  const puntajeMaximo = CHECKLIST_DESEMBOLSO.filter((i) => !i.obligatorio).reduce(
    (suma, i) => suma + i.puntos,
    0,
  );

  const razones: string[] = [];
  for (const etiqueta of faltantesObligatorios) {
    razones.push(`falta obligatorio: ${etiqueta}`);
  }
  if (puntaje < PUNTAJE_MINIMO_VERIFICACION) {
    razones.push(
      `completitud ${puntaje}/${puntajeMaximo} puntos — mínimo ${PUNTAJE_MINIMO_VERIFICACION}`,
    );
  } else {
    razones.push(`completitud ${puntaje}/${puntajeMaximo} puntos — cumple el mínimo`);
  }

  return {
    completa: faltantesObligatorios.length === 0 && puntaje >= PUNTAJE_MINIMO_VERIFICACION,
    puntaje,
    puntajeMaximo,
    puntajeMinimo: PUNTAJE_MINIMO_VERIFICACION,
    faltantesObligatorios,
    razones,
  };
}
