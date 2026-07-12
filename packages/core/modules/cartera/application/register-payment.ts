// Caso de uso: registrar un pago y repartirlo mora → interés → capital.

import type { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import { estaSaldada, type Cuota } from "../domain/installment";
import type { Pago } from "../domain/payment";
import {
  repartirPago,
  type AplicacionPago,
  type ComponentePago,
} from "../domain/payment-allocation";
import type {
  RepositorioCreditos,
  RepositorioPagos,
} from "../domain/repositories";

export interface ComandoRegistrarPago {
  creditoId: string;
  montoCentavos: number;
  fechaPago: string; // ISO yyyy-mm-dd
}

export interface PagoRegistrado {
  pago: Pago;
  aplicaciones: AplicacionPago[];
  totalesPorComponente: Record<ComponentePago, number>;
}

export class RegistrarPago {
  constructor(
    private readonly creditos: RepositorioCreditos,
    private readonly pagos: RepositorioPagos,
    private readonly bus: EventBus,
  ) {}

  async ejecutar(
    comando: ComandoRegistrarPago,
  ): Promise<Resultado<PagoRegistrado, string[]>> {
    if (
      !Number.isInteger(comando.montoCentavos) ||
      comando.montoCentavos <= 0
    ) {
      return fallo(["el monto del pago debe ser un entero en centavos mayor a cero"]);
    }

    const credito = await this.creditos.buscarPorId(comando.creditoId);
    if (!credito) {
      return fallo([`crédito no encontrado: ${comando.creditoId}`]);
    }
    if (credito.estado !== "activo") {
      return fallo([`el crédito está ${credito.estado}: no recibe pagos`]);
    }

    const cuotas = await this.creditos.cuotasDeCredito(comando.creditoId);
    if (cuotas.every(estaSaldada)) {
      return fallo(["el crédito no tiene saldo pendiente"]);
    }

    const reparto = repartirPago({
      montoCentavos: comando.montoCentavos,
      cuotas,
      fechaPago: comando.fechaPago,
      tasaMoraEA: credito.tasaMoraEA,
    });

    const pago = await this.pagos.guardar(
      {
        creditoId: comando.creditoId,
        montoCentavos: comando.montoCentavos,
        sobranteCentavos: reparto.sobranteCentavos,
        fechaPago: comando.fechaPago,
      },
      reparto.aplicaciones,
    );

    await this.actualizarCuotas(cuotas, reparto.aplicaciones);

    const totales = totalesPorComponente(reparto.aplicaciones);
    await this.bus.emit("cartera.pago.registrado", {
      pagoId: pago.id,
      creditoId: comando.creditoId,
      tiendaId: credito.tiendaId,
      montoCentavos: comando.montoCentavos,
      sobranteCentavos: reparto.sobranteCentavos,
      fecha: comando.fechaPago,
      ...totales,
    });

    return exito({ pago, aplicaciones: reparto.aplicaciones, totalesPorComponente: totales });
  }

  private async actualizarCuotas(
    cuotas: Cuota[],
    aplicaciones: AplicacionPago[],
  ): Promise<void> {
    const porCuota = new Map<number, AplicacionPago[]>();
    for (const a of aplicaciones) {
      porCuota.set(a.cuotaNumero, [...(porCuota.get(a.cuotaNumero) ?? []), a]);
    }
    for (const [numero, apls] of porCuota) {
      const cuota = cuotas.find((c) => c.numero === numero)!;
      const suma = (componente: ComponentePago) =>
        apls
          .filter((a) => a.componente === componente)
          .reduce((s, a) => s + a.montoCentavos, 0);
      await this.pagos.actualizarAcumulados(cuota.id!, {
        capitalPagadoCentavos: cuota.capitalPagadoCentavos + suma("capital"),
        interesPagadoCentavos: cuota.interesPagadoCentavos + suma("interes"),
        moraPagadaCentavos: cuota.moraPagadaCentavos + suma("mora"),
      });
    }
  }
}

function totalesPorComponente(
  aplicaciones: AplicacionPago[],
): Record<ComponentePago, number> {
  const totales: Record<ComponentePago, number> = { mora: 0, interes: 0, capital: 0 };
  for (const a of aplicaciones) {
    totales[a.componente] += a.montoCentavos;
  }
  return totales;
}
