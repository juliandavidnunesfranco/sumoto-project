// Alias de compatibilidad: @/lib/utils es el canónico (ahí apunta components.json
// de shadcn), este archivo existía antes del init y varios componentes ya lo
// importan — se reexporta para no tener una segunda implementación duplicada.
export { cn } from "./utils";
