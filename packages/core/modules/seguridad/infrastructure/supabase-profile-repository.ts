import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil, RepositorioPerfiles, Rol } from "../domain/profile";

interface FilaPerfil {
  user_id: string;
  nombre: string;
  rol: Rol;
  tienda_id: string | null;
  empresa_id: string;
}

export class RepositorioPerfilesSupabase implements RepositorioPerfiles {
  constructor(private readonly supabase: SupabaseClient) {}

  async buscarPorUsuario(userId: string): Promise<Perfil | null> {
    const { data, error } = await this.supabase
      .from("perfiles")
      .select("user_id, nombre, rol, tienda_id, empresa_id")
      .eq("user_id", userId)
      .maybeSingle<FilaPerfil>();
    if (error) throw new Error(`[seguridad] error leyendo perfil: ${error.message}`);
    return data
      ? {
          userId: data.user_id,
          nombre: data.nombre,
          rol: data.rol,
          tiendaId: data.tienda_id,
          empresaId: data.empresa_id,
        }
      : null;
  }
}
