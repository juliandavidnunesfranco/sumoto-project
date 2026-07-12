// Implementaciones Supabase de los contratos de cartera.
// El vínculo solicitud↔crédito escribe en el schema links (Module Links).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Credito } from "../domain/credit";
import type { Cuota } from "../domain/installment";
import type { Pago } from "../domain/payment";
import type { AplicacionPago } from "../domain/payment-allocation";
import type {
  AcumuladosCuota,
  RepositorioCreditos,
  RepositorioPagos,
} from "../domain/repositories";
import {
  aCredito,
  aCuota,
  aFilaCreditoNueva,
  aFilaCuotaNueva,
  type FilaCredito,
  type FilaCuota,
} from "./mappers";

export class RepositorioCreditosSupabase implements RepositorioCreditos {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(credito: Credito): Promise<Credito> {
    const { data, error } = await this.supabase
      .schema("cartera")
      .from("creditos")
      .insert(aFilaCreditoNueva(credito))
      .select()
      .single<FilaCredito>();
    if (error) throw new Error(`[cartera] error guardando crédito: ${error.message}`);
    return aCredito(data);
  }

  async eliminar(creditoId: string): Promise<void> {
    const { error } = await this.supabase
      .schema("cartera")
      .from("creditos")
      .delete()
      .eq("id", creditoId);
    if (error) throw new Error(`[cartera] error eliminando crédito: ${error.message}`);
  }

  async buscarPorId(creditoId: string): Promise<Credito | null> {
    const { data, error } = await this.supabase
      .schema("cartera")
      .from("creditos")
      .select()
      .eq("id", creditoId)
      .maybeSingle<FilaCredito>();
    if (error) throw new Error(`[cartera] error buscando crédito: ${error.message}`);
    return data ? aCredito(data) : null;
  }

  async guardarCuotas(creditoId: string, cuotas: Cuota[]): Promise<Cuota[]> {
    const { data, error } = await this.supabase
      .schema("cartera")
      .from("cuotas")
      .insert(cuotas.map((c) => aFilaCuotaNueva(creditoId, c)))
      .select()
      .returns<FilaCuota[]>();
    if (error) throw new Error(`[cartera] error guardando cuotas: ${error.message}`);
    return (data ?? []).map(aCuota);
  }

  async eliminarCuotasDeCredito(creditoId: string): Promise<void> {
    const { error } = await this.supabase
      .schema("cartera")
      .from("cuotas")
      .delete()
      .eq("credito_id", creditoId);
    if (error) throw new Error(`[cartera] error eliminando cuotas: ${error.message}`);
  }

  async cuotasDeCredito(creditoId: string): Promise<Cuota[]> {
    const { data, error } = await this.supabase
      .schema("cartera")
      .from("cuotas")
      .select()
      .eq("credito_id", creditoId)
      .order("numero")
      .returns<FilaCuota[]>();
    if (error) throw new Error(`[cartera] error leyendo cuotas: ${error.message}`);
    return (data ?? []).map(aCuota);
  }

  async vincularSolicitud(solicitudId: string, creditoId: string): Promise<void> {
    const { error } = await this.supabase
      .schema("links")
      .from("solicitud_credito")
      .insert({ solicitud_id: solicitudId, credito_id: creditoId });
    if (error) throw new Error(`[cartera] error vinculando solicitud: ${error.message}`);
  }

  async desvincularSolicitud(solicitudId: string, creditoId: string): Promise<void> {
    const { error } = await this.supabase
      .schema("links")
      .from("solicitud_credito")
      .delete()
      .eq("solicitud_id", solicitudId)
      .eq("credito_id", creditoId);
    if (error) throw new Error(`[cartera] error desvinculando solicitud: ${error.message}`);
  }
}

export class RepositorioPagosSupabase implements RepositorioPagos {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(pago: Pago, aplicaciones: AplicacionPago[]): Promise<Pago> {
    const { data, error } = await this.supabase
      .schema("cartera")
      .from("pagos")
      .insert({
        credito_id: pago.creditoId,
        monto_centavos: pago.montoCentavos,
        sobrante_centavos: pago.sobranteCentavos,
        fecha_pago: pago.fechaPago,
      })
      .select()
      .single<{ id: string }>();
    if (error) throw new Error(`[cartera] error guardando pago: ${error.message}`);

    const { error: errorApl } = await this.supabase
      .schema("cartera")
      .from("aplicaciones_pago")
      .insert(
        aplicaciones.map((a) => ({
          pago_id: data.id,
          cuota_id: a.cuotaId,
          componente: a.componente,
          monto_centavos: a.montoCentavos,
        })),
      );
    if (errorApl) {
      throw new Error(`[cartera] error guardando aplicaciones: ${errorApl.message}`);
    }
    return { ...pago, id: data.id };
  }

  async eliminar(pagoId: string): Promise<void> {
    // las aplicaciones caen por on delete cascade
    const { error } = await this.supabase
      .schema("cartera")
      .from("pagos")
      .delete()
      .eq("id", pagoId);
    if (error) throw new Error(`[cartera] error eliminando pago: ${error.message}`);
  }

  async actualizarAcumulados(
    cuotaId: string,
    acumulados: AcumuladosCuota,
  ): Promise<void> {
    const { error } = await this.supabase
      .schema("cartera")
      .from("cuotas")
      .update({
        capital_pagado_centavos: acumulados.capitalPagadoCentavos,
        interes_pagado_centavos: acumulados.interesPagadoCentavos,
        mora_pagada_centavos: acumulados.moraPagadaCentavos,
      })
      .eq("id", cuotaId);
    if (error) throw new Error(`[cartera] error actualizando cuota: ${error.message}`);
  }
}
