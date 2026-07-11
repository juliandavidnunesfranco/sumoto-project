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
    ingresosDeclaradosCentavos: registro.ingresosDeclaradosCentavos,
    fuenteIdentidad: registro.fuenteIdentidad,
    tiendaId: registro.tiendaId,
  });
}

// TODO(Julián): reglas de negocio para aceptar un registro de cliente.
// Devuelve un mensaje por cada violación encontrada (vacío = datos aceptables).
// Propuesta inicial a confirmar/ajustar con criterio bancario:
//   - cédula: solo dígitos, longitud razonable para CC colombiana (¿6 a 10?)
//   - nombres y apellidos no vacíos
//   - mayor de 18 años si viene fechaNacimiento (¿debe ser obligatoria para crédito?)
//   - ingresos declarados: entero >= 0 (¿mínimo para originar?)
//   - tiendaId presente
export function validarParaRegistro(
  datos: DatosCiudadano,
  registro: DatosRegistro,
): string[] {
  const violaciones: string[] = [];
  // --- implementar aquí ---
  return violaciones;
}
