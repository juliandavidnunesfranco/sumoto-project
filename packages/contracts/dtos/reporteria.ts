// DTOs de frontera de reporteria: la app tipa aquí los filtros que arma
// desde searchParams (crearTableQuery) para las tablas de datos.
//
// La DEFINICIÓN vive en el core, junto al mapa de estrategias que la aplica
// (son un solo contrato: interface + mapa se compilan juntos). Se re-exporta
// desde contracts para que la app tenga una sola puerta de tipos de frontera
// sin invertir la flecha de dependencia contracts → core.

export type {
  FiltrosAsientos,
  FiltrosCarteraTienda,
  FiltrosRecaudoMensual,
  FiltrosSolicitudes,
} from "@sumo/core";
