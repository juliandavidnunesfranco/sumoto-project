// Contrato de cartera hacia la originación (DIP, regla 3): cartera dice QUÉ
// necesita saber de una solicitud para desembolsarla; quién lo provee se
// resuelve por container en module.ts. TS puro — cero imports de otro módulo.

export interface SolicitudParaDesembolso {
  solicitudId: string;
  clienteId: string;
  tiendaId: string;
  plazoMeses: number;
  // valor moto - cuota inicial + cargos: la regla vive en originación,
  // aquí llega ya calculado.
  montoAFinanciarCentavos: number;
  // tasa del producto de crédito con el que se evaluó
  tasaEA: number;
  aprobada: boolean;
  estado: "pendiente" | "evaluada" | "desembolsada";
  // etapa de otorgamiento (SARC): expediente completo o no, con razones —
  // la regla vive en originación, aquí llega ya evaluada.
  verificacionCompleta: boolean;
  verificacionRazones: string[];
}

export interface FuenteSolicitudesAprobadas {
  paraDesembolso(solicitudId: string): Promise<SolicitudParaDesembolso | null>;
}
