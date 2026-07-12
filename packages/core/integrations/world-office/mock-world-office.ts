// Mock de World Office (versión/API reales por confirmar — ver preguntas
// abiertas en docs/STATUS.md). Acepta el asiento y devuelve un id externo.
// Cuando llegue la doc real, WorldOfficeReal implementa este mismo contrato.

import { exito, type Resultado } from "../../kernel/result";
import type {
  AsientoContable,
  SistemaContable,
} from "../../modules/contabilidad/index";

export class WorldOfficeMock implements SistemaContable {
  private contador = 0;

  async despachar(
    asiento: AsientoContable,
  ): Promise<Resultado<{ idExterno: string }, string>> {
    // Latencia simulada del sistema contable
    await new Promise((r) => setTimeout(r, 200));
    this.contador += 1;
    console.log(
      `[world-office:mock] asiento recibido "${asiento.descripcion}" (${asiento.partidas.length} partidas)`,
    );
    return exito({ idExterno: `WO-${String(this.contador).padStart(6, "0")}` });
  }
}
