// Pago recibido sobre un crédito. El detalle de a dónde fue cada peso
// vive en las aplicaciones (payment-allocation).

export interface Pago {
  id?: string;
  creditoId: string;
  montoCentavos: number;
  sobranteCentavos: number;
  fechaPago: string; // ISO yyyy-mm-dd
}
