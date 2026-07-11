// El parlante: los módulos anuncian hechos; quien esté interesado, escucha.
// Nadie conoce a nadie — ese es el desacople que sostiene todo el sistema.

export interface EventoDominio<T = unknown> {
  nombre: string; // "cartera.pago.registrado"
  payload: T; // los datos del hecho
  ocurridoEn: Date;
  correlacionId?: string; // para rastrear una operación a través de módulos
}

type Manejador = (evento: EventoDominio) => Promise<void> | void;

export class EventBus {
  private suscriptores = new Map<string, Manejador[]>();

  // Contabilidad dice: "avísame cuando pase X"
  on(nombreEvento: string, manejador: Manejador): void {
    const lista = this.suscriptores.get(nombreEvento) ?? [];
    lista.push(manejador);
    this.suscriptores.set(nombreEvento, lista);
  }

  // Cartera anuncia: "pasó X" — y sigue con su vida
  async emit<T>(
    nombre: string,
    payload: T,
    correlacionId?: string,
  ): Promise<void> {
    const evento: EventoDominio<T> = {
      nombre,
      payload,
      ocurridoEn: new Date(),
      correlacionId,
    };

    const manejadores = this.suscriptores.get(nombre) ?? [];
    for (const manejar of manejadores) {
      try {
        await manejar(evento as EventoDominio);
      } catch (error) {
        // Un oyente que falla NO tumba al que anunció ni a los demás oyentes.
        // Aquí luego conectamos el outbox/reintentos; por ahora, registrar y seguir.
        console.error(`[event-bus] fallo manejando "${nombre}":`, error);
      }
    }
  }
}
