// Frontera HTTP → core: registrar cliente. Zod valida la FORMA; el negocio
// lo valida el dominio (los predicados compartidos vienen del core — única
// fuente de verdad, patrón .refine()).

import { esCedulaValida } from "@sumo/core";
import { z } from "zod";

export const DatosManualesSchema = z.object({
  cedula: z.string().refine(esCedulaValida, {
    message: "la cédula debe tener entre 6 y 10 dígitos",
  }),
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  fechaNacimiento: z.iso.date().optional(),
  telefono: z.string().optional(),
  email: z.email().optional(),
  direccion: z.string().optional(),
  ciudad: z.string().optional(),
});

export const RegistrarClienteRequestSchema = z.discriminatedUnion("fuente", [
  z.object({
    fuente: z.literal("escaner"),
    // el código que entrega el escáner (en la demo: el número de cédula)
    codigo: z.string().min(1),
    ingresosDeclaradosCentavos: z.number().int().nonnegative().optional(),
  }),
  z.object({
    fuente: z.literal("entrada_manual"),
    datos: DatosManualesSchema,
    ingresosDeclaradosCentavos: z.number().int().nonnegative().optional(),
  }),
]);

export type RegistrarClienteRequest = z.infer<typeof RegistrarClienteRequestSchema>;

export interface ClienteResponse {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  ciudad?: string;
  fechaNacimiento?: string;
}
