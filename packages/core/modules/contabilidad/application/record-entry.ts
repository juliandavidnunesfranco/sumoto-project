// Registrar un asiento: persistir SIEMPRE, despachar a World Office después.
// Si el despacho falla, el asiento queda 'fallido' para reintento — la
// contabilidad interna nunca depende de que el externo esté vivo.

import type { AsientoContable } from "../domain/journal-entry";
import type { SistemaContable } from "../domain/accounting-system";
import type { RepositorioAsientos } from "../domain/repositories";

export class RegistrarAsiento {
  constructor(
    private readonly asientos: RepositorioAsientos,
    private readonly sistemaContable: SistemaContable,
  ) {}

  async ejecutar(asiento: AsientoContable): Promise<AsientoContable> {
    const guardado = await this.asientos.guardar(asiento);

    const despacho = await this.sistemaContable.despachar(guardado);
    if (despacho.ok) {
      await this.asientos.marcarDespacho(
        guardado.id!,
        "despachado",
        despacho.valor.idExterno,
      );
    } else {
      console.error(
        `[contabilidad] despacho fallido del asiento ${guardado.id}: ${despacho.error}`,
      );
      await this.asientos.marcarDespacho(guardado.id!, "fallido");
    }
    return guardado;
  }
}
