// Cargos adicionales seleccionables por el vendedor en cada solicitud
// (papelería, SOAT, etc.) — no son atributo fijo de la moto, por eso viven
// aquí y no en el catálogo. Montos de demo, se suman al monto a financiar.

export interface CargoAdicional {
  id: string;
  nombre: string;
  montoCentavos: number;
}

export const CARGOS_ADICIONALES_DEMO: CargoAdicional[] = [
  { id: "papeleria", nombre: "Papelería y trámite", montoCentavos: 15000000 },
  { id: "soat", nombre: "Emisión de SOAT", montoCentavos: 45000000 },
  { id: "matricula", nombre: "Matrícula e impuestos", montoCentavos: 25000000 },
  { id: "seguro-vida", nombre: "Seguro de vida deudor", montoCentavos: 12000000 },
];
