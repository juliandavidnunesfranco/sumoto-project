// Los datos de una persona tal como los entrega una fuente de identidad
// (escáner de cédula o entrada manual), ya traducidos al idioma del dominio.

export type FuenteDeDatos = "escaner" | "entrada_manual";

export interface DatosCiudadano {
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string; // ISO yyyy-mm-dd
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
}
