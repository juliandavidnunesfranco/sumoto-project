// Implementación Supabase del contrato RepositorioMotos.
// La tabla guarda solo el nombre del objeto en el bucket "motos" (Storage);
// la URL pública se resuelve aquí — es un detalle de infraestructura, el
// dominio solo conoce `imagen` como una URL ya servible.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Moto } from "../domain/moto";
import type {
  OpcionesBusquedaMotos,
  RepositorioMotos,
  ResultadoPaginado,
} from "../domain/repository";
import { aMoto, type FilaMoto } from "./moto-mapper";

const BUCKET_MOTOS = "motos";

export class RepositorioMotosSupabase implements RepositorioMotos {
  constructor(private readonly supabase: SupabaseClient) {}

  private conUrlPublica(fila: FilaMoto): FilaMoto {
    const { data } = this.supabase.storage.from(BUCKET_MOTOS).getPublicUrl(fila.imagen);
    return { ...fila, imagen: data.publicUrl };
  }

  async buscar(opciones: OpcionesBusquedaMotos): Promise<ResultadoPaginado<Moto>> {
    const pagina = Math.max(1, opciones.pagina);
    const porPagina = Math.max(1, opciones.porPagina);
    const desde = (pagina - 1) * porPagina;
    const hasta = desde + porPagina - 1;

    let consulta = this.supabase
      .schema("catalogo")
      .from("motos")
      .select("*", { count: "exact" })
      .eq("activo", true)
      .order("nombre");

    const query = opciones.query?.trim();
    if (query) {
      consulta = consulta.ilike("nombre", `%${query}%`);
    }

    const { data, error, count } = await consulta
      .range(desde, hasta)
      .returns<FilaMoto[]>();

    if (error) {
      throw new Error(`[catalogo] error buscando motos: ${error.message}`);
    }
    return { items: (data ?? []).map((fila) => aMoto(this.conUrlPublica(fila))), total: count ?? 0 };
  }

  async buscarPorId(id: string): Promise<Moto | null> {
    const { data, error } = await this.supabase
      .schema("catalogo")
      .from("motos")
      .select()
      .eq("id", id)
      .maybeSingle<FilaMoto>();

    if (error) {
      throw new Error(`[catalogo] error buscando moto por id: ${error.message}`);
    }
    return data ? aMoto(this.conUrlPublica(data)) : null;
  }
}
