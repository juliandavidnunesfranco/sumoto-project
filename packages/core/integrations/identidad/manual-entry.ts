// Entrada manual: el vendedor digita los datos en el formulario.
// Traduce el payload crudo del formulario a DatosCiudadano (el formato externo
// muere aquí). Sustituible por el escáner sin tocar consumidores (LSP).

import { exito, fallo, type Resultado } from "../../kernel/result";
import type {
  DatosCiudadano,
  FuenteIdentidad,
} from "../../modules/clientes/index";

export class EntradaManual implements FuenteIdentidad {
  readonly nombre = "entrada_manual" as const;

  async capturar(
    entradaCruda: unknown,
  ): Promise<Resultado<DatosCiudadano, string>> {
    if (typeof entradaCruda !== "object" || entradaCruda === null) {
      return fallo("entrada manual inválida: se esperaba un objeto con los datos");
    }
    const datos = entradaCruda as Record<string, unknown>;

    const cedula = textoOVacio(datos.cedula);
    const nombres = textoOVacio(datos.nombres);
    const apellidos = textoOVacio(datos.apellidos);
    if (!cedula || !nombres || !apellidos) {
      return fallo("entrada manual incompleta: cédula, nombres y apellidos son obligatorios");
    }

    return exito({
      cedula,
      nombres,
      apellidos,
      fechaNacimiento: textoOpcional(datos.fechaNacimiento),
      telefono: textoOpcional(datos.telefono),
      email: textoOpcional(datos.email),
      direccion: textoOpcional(datos.direccion),
      ciudad: textoOpcional(datos.ciudad),
    });
  }
}

function textoOVacio(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function textoOpcional(valor: unknown): string | undefined {
  const texto = textoOVacio(valor);
  return texto === "" ? undefined : texto;
}
