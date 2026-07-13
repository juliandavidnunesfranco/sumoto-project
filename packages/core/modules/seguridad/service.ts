// Fachada del módulo seguridad — token modulo.seguridad.service.

import type { Perfil, RepositorioPerfiles, Rol } from "./domain/profile";

export class SeguridadService {
  constructor(private readonly perfiles: RepositorioPerfiles) {}

  perfilDe(userId: string): Promise<Perfil | null> {
    return this.perfiles.buscarPorUsuario(userId);
  }

  async tieneAcceso(userId: string, permitidos: Rol[]): Promise<Perfil | null> {
    const perfil = await this.perfilDe(userId);
    return perfil && permitidos.includes(perfil.rol) ? perfil : null;
  }
}
