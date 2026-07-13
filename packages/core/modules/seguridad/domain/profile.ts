// Quién es quién dentro de SUMOTO: el perfil liga al usuario autenticado
// (proveedor de identidad: Supabase Auth) con su rol y su tienda.
// El LOGIN (cookies, sesión) es plumbing de la app; el PERFIL es del core.

export type Rol = "vendedor" | "manager" | "financiero" | "contable" | "ceo";

export interface Perfil {
  userId: string;
  nombre: string;
  rol: Rol;
  tiendaId: string | null;
}

export interface RepositorioPerfiles {
  buscarPorUsuario(userId: string): Promise<Perfil | null>;
}

// Los roles atados a una tienda (los demás son globales)
export function esRolDeTienda(rol: Rol): boolean {
  return rol === "vendedor" || rol === "manager";
}
