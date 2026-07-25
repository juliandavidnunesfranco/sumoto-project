// Frontera HTTP → core: el financiero administra el expediente de
// verificación pre-desembolso. La whitelist REAL de ítems vive en el dominio
// (esCodigoDeChecklist) — aquí solo se valida la FORMA (capa 1 de 3).

import { z } from "zod";

export const MarcarVerificacionRequestSchema = z.object({
  solicitudId: z.uuid(),
  itemCodigo: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "código de ítem inválido"),
  marcado: z.boolean(),
});
export type MarcarVerificacionRequest = z.infer<typeof MarcarVerificacionRequestSchema>;

// Documentos del expediente: los límites duros (tamaño/mime) también los
// impone el bucket; esto corta temprano y con mensaje claro.
export const MIMES_DOCUMENTO = ["application/pdf", "image/png", "image/jpeg"] as const;
export const TAMANO_MAXIMO_DOCUMENTO_BYTES = 5 * 1024 * 1024; // 5 MiB

export const SubirDocumentoRequestSchema = z.object({
  solicitudId: z.uuid(),
  nombre: z
    .string()
    .min(1)
    .max(120)
    // sin separadores de ruta ni saltos: el nombre es una sola pieza del objeto
    .regex(/^[^/\\\n\r]+$/, "nombre de archivo inválido"),
  mime: z.enum(MIMES_DOCUMENTO),
  tamanoBytes: z.number().int().positive().max(TAMANO_MAXIMO_DOCUMENTO_BYTES),
});
export type SubirDocumentoRequest = z.infer<typeof SubirDocumentoRequestSchema>;
