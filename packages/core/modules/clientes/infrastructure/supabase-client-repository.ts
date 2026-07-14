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

  async buscar(query: string, tiendaId?: string): Promise<Cliente[]> {
    // Sanea metacaracteres del filtro PostgREST (, ( ) * \ . " ') antes de
    // interpolar: sin esto un término como `x,tienda_id.eq.otra-tienda` podría
    // inyectar condiciones extra al .or() y saltarse el acotamiento por tienda.
    const limpia = query.trim().replace(/[,()*\\."']/g, "");
    if (!limpia) return [];

    let consulta = this.supabase
      .schema("clientes")
      .from("clientes")
      .select()
      .or(`nombres.ilike.%${limpia}%,apellidos.ilike.%${limpia}%,cedula.ilike.%${limpia}%`)
      .order("nombres")
      .limit(8);

    if (tiendaId) {
      consulta = consulta.eq("tienda_id", tiendaId);
    }

    const { data, error } = await consulta.returns<FilaCliente[]>();
    if (error) {
      throw new Error(`[clientes] error buscando clientes: ${error.message}`);
    }
    return (data ?? []).map(aCliente);
  }
}
