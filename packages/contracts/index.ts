// Puerta única de @sumo/contracts: schemas Zod (forma) y DTOs de frontera.
// Las apps importan de AQUÍ y de las fachadas del core — jamás de domain/.

export * from "./schemas/login";
export * from "./schemas/register-client";
export * from "./schemas/evaluate-application";
export * from "./schemas/manage-credit-product";
export * from "./schemas/verify-disbursement";
export * from "./dtos/reporteria";
