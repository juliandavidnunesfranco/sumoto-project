// Mock del escáner de cédula del tercero (proveedor y patrón de API aún por
// confirmar — ver "Preguntas abiertas" en docs/STATUS.md). Simula la respuesta
// a partir del número de cédula, con datos deterministas para la demo.
// Cuando llegue la doc real, se crea EscanerCedulaReal con este mismo contrato
// y se cambia el binding en module.ts (OCP: cero cambios en dominio).

import { exito, fallo, type Resultado } from "../../kernel/result";
import type {
  DatosCiudadano,
  FuenteIdentidad,
} from "../../modules/clientes/index";

const NOMBRES_DEMO = ["Carlos", "María", "Andrés", "Luisa", "Jorge", "Camila"];
const APELLIDOS_DEMO = ["Rodríguez", "Gómez", "Martínez", "López", "Torres", "Rojas"];
const CIUDADES_DEMO = ["Bogotá", "Medellín", "Cali", "Barranquilla"];
// Un barrio representativo por ciudad — hace de "dirección corta" para la demo.
const BARRIOS_DEMO = ["Chapinero", "El Poblado", "Ciudad Jardín", "El Prado"];

export class EscanerCedulaMock implements FuenteIdentidad {
  readonly nombre = "escaner" as const;

  async capturar(
    entradaCruda: unknown,
  ): Promise<Resultado<DatosCiudadano, string>> {
    const codigo = extraerCodigo(entradaCruda);
    if (!codigo) {
      return fallo("escaneo inválido: no se recibió el código de la cédula");
    }
    if (!/^\d{6,10}$/.test(codigo)) {
      return fallo(`el escáner no pudo leer la cédula "${codigo}"`);
    }

    // Latencia simulada del proveedor
    await new Promise((r) => setTimeout(r, 300));

    // Datos deterministas: la misma cédula siempre devuelve la misma persona
    const semilla = Number(codigo) % NOMBRES_DEMO.length;
    const indiceCiudad = Number(codigo) % CIUDADES_DEMO.length;
    return exito({
      cedula: codigo,
      nombres: NOMBRES_DEMO[semilla],
      apellidos: `${APELLIDOS_DEMO[semilla]} ${APELLIDOS_DEMO[(semilla + 2) % APELLIDOS_DEMO.length]}`,
      fechaNacimiento: `19${70 + (Number(codigo) % 30)}-0${1 + (semilla % 9)}-15`,
      ciudad: CIUDADES_DEMO[indiceCiudad],
      direccion: BARRIOS_DEMO[indiceCiudad],
      estrato: 1 + (Number(codigo) % 6),
      geoCoincide: Number(codigo) % 5 !== 0,
    });
  }
}

function extraerCodigo(entradaCruda: unknown): string | null {
  if (typeof entradaCruda === "string") return entradaCruda.trim();
  if (typeof entradaCruda === "object" && entradaCruda !== null) {
    const codigo = (entradaCruda as Record<string, unknown>).codigo;
    if (typeof codigo === "string") return codigo.trim();
  }
  return null;
}
