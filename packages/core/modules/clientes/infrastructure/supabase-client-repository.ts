// Implementación Supabase del contrato RepositorioClientes.
// El cliente de Supabase llega por DI; aquí las fallas de infraestructura SÍ son
// excepciones (lo excepcional), a diferencia de las violaciones de negocio.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente } from "../domain/client";
import type { RepositorioClientes } from "../domain/client-repository";
import { aCliente, aFilaNueva, type FilaCliente } from "./client-mapper";

export class RepositorioClientesSupabase implements RepositorioClientes {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(cliente: Cliente): Promise<Cliente> {
    const { data, error } = await this.supabase
      .schema("clientes")
      .from("clientes")
      .insert(aFilaNueva(cliente))
      .select()
      .single<FilaCliente>();

    if (error) {
      throw new Error(`[clientes] error guardando cliente: ${error.message}`);
    }
    return aCliente(data);
  }

  async buscarPorCedula(cedula: string): Promise<Cliente | null> {
    const { data, error } = await this.supabase
      .schema("clientes")
      .from("clientes")
      .select()
      .eq("cedula", cedula)
      .maybeSingle<FilaCliente>();

    if (error) {
      throw new Error(`[clientes] error buscando por cédula: ${error.message}`);
    }
    return data ? aCliente(data) : null;
  }
}
