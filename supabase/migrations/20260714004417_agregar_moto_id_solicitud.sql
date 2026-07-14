-- Moto elegida por el vendedor (módulo catalogo): referencia plana sin FK
-- cruzada entre schemas (regla 3) — mismo patrón que cliente_id/producto_id,
-- se conoce desde que se crea la solicitud, no nace de un workflow aparte.
-- NOT NULL sin default: aceptable porque el proyecto sigue en fase de demo,
-- sin datos reales que puedan romperse por la migración.
alter table originacion.solicitudes
  add column moto_id uuid not null;
