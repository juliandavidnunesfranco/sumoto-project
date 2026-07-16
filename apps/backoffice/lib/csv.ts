// Serialización CSV para exportar tablas (presentación pura — los datos
// SIEMPRE vienen ya resueltos de una fachada del core, regla 1). RFC 4180:
// separador coma, CRLF, comillas escapadas duplicándolas; BOM UTF-8 al
// frente para que Excel abra tildes y eñes sin ensalada de caracteres.

export interface ColumnaCsv<T> {
  titulo: string;
  valor: (fila: T) => string | number | null | undefined;
}

function escapar(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv<T>(columnas: ColumnaCsv<T>[], filas: T[]): string {
  const lineas = [columnas.map((c) => escapar(c.titulo)).join(",")];
  for (const fila of filas) {
    lineas.push(columnas.map((c) => escapar(c.valor(fila))).join(","));
  }
  return "\ufeff" + lineas.join("\r\n");
}

/** Centavos → pesos con 2 decimales ("12000000.50"): el CSV no pierde el
 *  centavo aunque la UI lo redondee. String, jamás float (regla de dinero). */
export function pesosCsv(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function respuestaCsv(nombreArchivo: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
