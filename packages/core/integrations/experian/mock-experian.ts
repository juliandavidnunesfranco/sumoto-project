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

// Forma del JSON que respondería el buró real (solo existe en este adaptador)
interface RespuestaCrudaExperian {
  documento: string;
  puntaje: { valor: number; modelo: string };
  historial: { peor_mora_12m_dias: number; saldo_total_cop: number };
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
      consultadoEn: cruda.fecha_consulta,
    });
  }
}

function simularRespuestaDelBuro(cedula: string): RespuestaCrudaExperian {
  const ultimo = Number(cedula[cedula.length - 1]);
  const penultimo = Number(cedula[cedula.length - 2] ?? "0");

  const score =
    ultimo <= 1 ? 510 + ultimo * 30 : ultimo <= 3 ? 615 + (ultimo - 2) * 20 : 700 + (ultimo - 4) * 25;

  return {
    documento: cedula,
    puntaje: { valor: score, modelo: "HDC3-MOCK" },
    historial: {
      peor_mora_12m_dias: penultimo === 9 ? 90 : penultimo >= 7 ? 30 : 0,
      saldo_total_cop: (Number(cedula) % 7) * 1_500_000,
    },
    fecha_consulta: new Date().toISOString(),
  };
}
