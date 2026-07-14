// Mock de Experian: simula la respuesta cruda del buró y la TRADUCE a
// ReporteRiesgo (el JSON externo muere aquí — regla 5). Determinista por cédula
// para poder guiar la demo:
//   - último dígito 0–1  → score bajo (~500s)   → NEGADO
//   - último dígito 2–3  → score zona gris       → REVISION_MANUAL
//   - último dígito 4–9  → score alto (700+)     → APROBADO (si lo demás cabe)
//   - penúltimo dígito 9 → mora 90 días reportada

import { exito, fallo, type Resultado } from "../../kernel/result";
import type {
  ConsultorRiesgo,
  ReporteRiesgo,
} from "../../modules/originacion/index";

const ENTIDADES_DEMO = ["Bancolombia", "Nequi", "Davivienda", "Banco de Bogotá", "Falabella"];
const PRODUCTOS_DEMO = ["Tarjeta de crédito", "Crédito de consumo", "Libranza"];

interface LineaCreditoCruda {
  entidad: string;
  tipo_producto: string;
  saldo_cop: number;
  dias_mora: number;
}

// Forma del JSON que respondería el buró real (solo existe en este adaptador)
interface RespuestaCrudaExperian {
  documento: string;
  puntaje: { valor: number; modelo: string };
  historial: { peor_mora_12m_dias: number; saldo_total_cop: number; reporte_negativo: boolean };
  lineas_credito: LineaCreditoCruda[];
  fecha_consulta: string;
}

export class ExperianMock implements ConsultorRiesgo {
  async consultar(cedula: string): Promise<Resultado<ReporteRiesgo, string>> {
    const limpia = cedula.trim();
    if (!/^\d{6,10}$/.test(limpia)) {
      return fallo(`Experian no reconoce el documento "${cedula}"`);
    }

    // Latencia simulada del buró
    await new Promise((r) => setTimeout(r, 400));

    const cruda = simularRespuestaDelBuro(limpia);

    // Traducción formato externo → dominio (centavos, nombres del negocio)
    return exito({
      cedula: cruda.documento,
      score: cruda.puntaje.valor,
      moraMaximaDiasUltimos12Meses: cruda.historial.peor_mora_12m_dias,
      endeudamientoCentavos: cruda.historial.saldo_total_cop * 100,
      reportesNegativos: cruda.historial.reporte_negativo,
      vectoresPago: cruda.lineas_credito.map((l) => ({
        entidad: l.entidad,
        tipoProducto: l.tipo_producto,
        saldoCentavos: l.saldo_cop * 100,
        diasMora: l.dias_mora,
      })),
      consultadoEn: cruda.fecha_consulta,
    });
  }
}

function simularRespuestaDelBuro(cedula: string): RespuestaCrudaExperian {
  const ultimo = Number(cedula[cedula.length - 1]);
  const penultimo = Number(cedula[cedula.length - 2] ?? "0");
  const numero = Number(cedula);

  const score =
    ultimo <= 1 ? 510 + ultimo * 30 : ultimo <= 3 ? 615 + (ultimo - 2) * 20 : 700 + (ultimo - 4) * 25;
  const moraMaxima = penultimo === 9 ? 90 : penultimo >= 7 ? 30 : 0;

  const cantidadLineas = 1 + (ultimo % 3);
  const lineas: LineaCreditoCruda[] = Array.from({ length: cantidadLineas }, (_, i) => ({
    entidad: ENTIDADES_DEMO[(numero + i) % ENTIDADES_DEMO.length],
    tipo_producto: PRODUCTOS_DEMO[(numero + i) % PRODUCTOS_DEMO.length],
    saldo_cop: ((numero + i * 37) % 20) * 100_000 + 200_000,
    dias_mora: i === 0 ? moraMaxima : 0,
  }));

  return {
    documento: cedula,
    puntaje: { valor: score, modelo: "HDC3-MOCK" },
    historial: {
      peor_mora_12m_dias: moraMaxima,
      saldo_total_cop: lineas.reduce((suma, l) => suma + l.saldo_cop, 0),
      reporte_negativo: penultimo === 9,
    },
    lineas_credito: lineas,
    fecha_consulta: new Date().toISOString(),
  };
}
