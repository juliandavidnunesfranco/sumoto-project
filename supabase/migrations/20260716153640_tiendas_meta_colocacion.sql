-- =============================================================================
-- Meta de colocación mensual por tienda (backlog 2026-07-15, punto 1).
-- La meta es dato organizacional → vive en public.tiendas (como perfiles);
-- se expone a la app por la vista reporteria.cartera_por_tienda (la columna
-- nueva va AL FINAL: create or replace view no permite reordenar columnas).
-- =============================================================================

alter table public.tiendas
  add column meta_colocacion_centavos bigint not null default 0;

-- Metas demo: por encima de la colocación histórica (~$17-19M/mes entre las
-- dos tiendas) para que la barra muestre un avance parcial creíble.
update public.tiendas set meta_colocacion_centavos = 2500000000
  where id = '11111111-1111-4111-8111-111111111111'; -- Bogotá Norte: $25M
update public.tiendas set meta_colocacion_centavos = 2000000000
  where id = '22222222-2222-4222-8222-222222222222'; -- Medellín Centro: $20M

create or replace view reporteria.cartera_por_tienda
  with (security_invoker = true) as
select
  t.id as tienda_id,
  t.nombre as tienda_nombre,
  count(cc.credito_id) as creditos_activos,
  coalesce(sum(cc.capital_pendiente_centavos), 0)::bigint as capital_total_centavos,
  coalesce(sum(cc.capital_pendiente_centavos) filter (where cc.dias_mora > 0), 0)::bigint
    as capital_vencido_centavos,
  t.meta_colocacion_centavos
from public.tiendas t
left join reporteria.cartera_por_credito cc on cc.tienda_id = t.id
group by t.id, t.nombre, t.meta_colocacion_centavos;
