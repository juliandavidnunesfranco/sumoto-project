// Frontera HTTP → core: financiero crea productos y administra sus políticas.

import { z } from "zod";

export const ReglasDecisionSchema = z.object({
  scoreMinimo: z.number().int().min(150).max(950),
  scoreRevision: z.number().int().min(150).max(950).optional(),
  cuotaMaximaPorcentajeIngreso: z.number().min(0.01).max(1),
  ltvMaximo: z.number().min(0.01).max(1),
  ingresoMinimoCentavos: z.number().int().nonnegative().optional(),
  moraMaximaDias: z.number().int().nonnegative().optional(),
});

export const CrearProductoRequestSchema = z.object({
  nombre: z.string().min(1),
  tasaEA: z.number().min(0).max(2),
  plazoMinMeses: z.number().int().positive(),
  plazoMaxMeses: z.number().int().positive(),
  reglasDecision: ReglasDecisionSchema,
});
export type CrearProductoRequest = z.infer<typeof CrearProductoRequestSchema>;

export const ActualizarReglasRequestSchema = z.object({
  productoId: z.uuid(),
  reglasDecision: ReglasDecisionSchema,
});
export type ActualizarReglasRequest = z.infer<typeof ActualizarReglasRequestSchema>;

export const SimularDecisionRequestSchema = z.object({
  cedula: z.string().min(6),
  valorMotoCentavos: z.number().int().positive(),
  cuotaInicialCentavos: z.number().int().nonnegative(),
  plazoMeses: z.number().int().positive(),
  ingresosDeclaradosCentavos: z.number().int().positive(),
  tasaEA: z.number().min(0).max(2),
  reglasDecision: ReglasDecisionSchema,
});
export type SimularDecisionRequest = z.infer<typeof SimularDecisionRequestSchema>;
