// Frontera HTTP → core: evaluar solicitud de crédito.

import { esCedulaValida } from "@sumo/core";
import { z } from "zod";

export const EvaluarSolicitudRequestSchema = z.object({
  clienteId: z.uuid(),
  cedula: z.string().refine(esCedulaValida, {
    message: "la cédula debe tener entre 6 y 10 dígitos",
  }),
  productoId: z.uuid(),
  motoId: z.uuid(),
  valorMotoCentavos: z.number().int().positive(),
  cuotaInicialCentavos: z.number().int().nonnegative(),
  cargosAdicionalesCentavos: z.number().int().nonnegative().default(0),
  plazoMeses: z.number().int().positive(),
  ingresosDeclaradosCentavos: z.number().int().positive(),
});

export type EvaluarSolicitudRequest = z.infer<typeof EvaluarSolicitudRequestSchema>;

export interface DecisionResponse {
  solicitudId: string;
  resultado: "APROBADO" | "NEGADO" | "REVISION_MANUAL";
  razones: string[];
  score: number;
  cuotaEstimadaCentavos: number;
}

export interface ProductoResponse {
  id: string;
  nombre: string;
  tasaEA: number;
  plazoMinMeses: number;
  plazoMaxMeses: number;
}
