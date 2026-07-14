// Entidad Cliente: la persona sujeto de crédito, ya validada por el dominio.

import { exito, fallo, type Resultado } from "../../../kernel/result";
import type { DatosCiudadano, FuenteDeDatos } from "./citizen-data";

export interface Cliente {
  id?: string; // lo asigna la persistencia
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string; // ISO yyyy-mm-dd
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  estrato?: number;
  geoCoincide?: boolean;
  ingresosDeclaradosCentavos?: number; // dinero: entero en centavos, nunca float
  fuenteIdentidad: FuenteDeDatos;
  tiendaId: string;
}

export interface DatosRegistro {
  ingresosDeclaradosCentavos?: number;
  fuenteIdentidad: FuenteDeDatos;
  tiendaId: string;
}

// Fábrica de la entidad: la ÚNICA forma de crear un Cliente en el dominio.
// Si hay violaciones, devuelve la lista completa (no solo la primera) para que
// el vendedor corrija todo de una vez.
export function crearCliente(
  datos: DatosCiudadano,
  registro: DatosRegistro,
): Resultado<Cliente, string[]> {
  const violaciones = validarParaRegistro(datos, registro);
  if (violaciones.length > 0) {
    return fallo(violaciones);
  }
  return exito({
    cedula: datos.cedula.trim(),
    nombres: datos.nombres.trim(),
    apellidos: datos.apellidos.trim(),
    fechaNacimiento: datos.fechaNacimiento,
    telefono: datos.telefono,
    email: datos.email,
    direccion: datos.direccion,
    ciudad: datos.ciudad,
    estrato: datos.estrato,
    geoCoincide: datos.geoCoincide,
    ingresosDeclaradosCentavos: registro.ingresosDeclaradosCentavos,
    fuenteIdentidad: registro.fuenteIdentidad,
    tiendaId: registro.tiendaId,
  });
}

// Predicados puros: reutilizables por los schemas Zod de packages/contracts
// vía .refine() — única fuente de verdad de estas reglas.

export function esCedulaValida(cedula: string): boolean {
  return /^\d{6,10}$/.test(cedula.trim());
}

export function esMayorDeEdad(
  fechaNacimientoIso: string,
  hoy: Date = new Date(),
): boolean {
  const nacimiento = new Date(`${fechaNacimientoIso}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return false;
  const cumple18 = new Date(nacimiento);
  cumple18.setFullYear(cumple18.getFullYear() + 18);
  return cumple18 <= hoy;
}

// Reglas de registro (validadas con Julián 2026-07-11). El ingreso mínimo NO va
// aquí: es regla del producto en el motor de decisión de originación.
export function validarParaRegistro(
  datos: DatosCiudadano,
  registro: DatosRegistro,
): string[] {
  const violaciones: string[] = [];

  if (!esCedulaValida(datos.cedula)) {
    violaciones.push("la cédula debe tener entre 6 y 10 dígitos, solo números");
  }
  if (datos.nombres.trim() === "") {
    violaciones.push("los nombres son obligatorios");
  }
  if (datos.apellidos.trim() === "") {
    violaciones.push("los apellidos son obligatorios");
  }
  if (
    datos.fechaNacimiento !== undefined &&
    !esMayorDeEdad(datos.fechaNacimiento)
  ) {
    violaciones.push("el cliente debe ser mayor de 18 años");
  }
  if (
    datos.estrato !== undefined &&
    (!Number.isInteger(datos.estrato) || datos.estrato < 1 || datos.estrato > 6)
  ) {
    violaciones.push("el estrato debe ser un entero entre 1 y 6");
  }
  if (
    registro.ingresosDeclaradosCentavos !== undefined &&
    (!Number.isInteger(registro.ingresosDeclaradosCentavos) ||
      registro.ingresosDeclaradosCentavos < 0)
  ) {
    violaciones.push(
      "los ingresos declarados deben ser un entero en centavos, mayor o igual a cero",
    );
  }
  if (registro.tiendaId.trim() === "") {
    violaciones.push("la tienda que registra es obligatoria");
  }

  return violaciones;
}
