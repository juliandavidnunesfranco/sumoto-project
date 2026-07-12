-- =============================================================================
-- Módulo reporteria: SOLO LECTURA — vistas que cruzan schemas (equivalente al
-- Query de Medusa v2). Sin domain, sin tablas propias. security_invoker: las
-- vistas respetan el RLS del rol que consulta.
-- =============================================================================

create schema if not exists reporteria;

-- Foto de cada crédito activo: saldo, días de mora y franja
create or replace view reporteria.cartera_por_credito
  with (security_invoker = true) as
select
  c.id as credito_id,
  c.cliente_id,
  c.tienda_id,
  c.desembolsado_en,
  c.cuota_centavos,
  c.monto_desembolsado_centavos,
  sum(q.capital_centavos - q.capital_pagado_centavos)::bigint
    as capital_pendiente_centavos,
  coalesce(
    max(current_date - q.fecha_vencimiento) filter (
      where q.fecha_vencimiento < current_date
        and (q.capital_centavos - q.capital_pagado_centavos
           + q.interes_centavos - q.interes_pagado_centavos) > 0
    ),
    0
  ) as dias_mora,
  case
    when coalesce(
      max(current_date - q.fecha_vencimiento) filter (
        where q.fecha_vencimiento < current_date
          and (q.capital_centavos - q.capital_pagado_centavos
             + q.interes_centavos - q.interes_pagado_centavos) > 0
      ), 0) <= 30 then '0-30'
    when coalesce(
      max(current_date - q.fecha_vencimiento) filter (
        where q.fecha_vencimiento < current_date
          and (q.capital_centavos - q.capital_pagado_centavos
             + q.interes_centavos - q.interes_pagado_centavos) > 0
      ), 0) <= 60 then '31-60'
    when coalesce(
      max(current_date - q.fecha_vencimiento) filter (
        where q.fecha_vencimiento < current_date
          and (q.capital_centavos - q.capital_pagado_centavos
             + q.interes_centavos - q.interes_pagado_centavos) > 0
      ), 0) <= 90 then '61-90'
    else '90+'
  end as franja_mora
from cartera.creditos c
join cartera.cuotas q on q.credito_id = c.id
where c.estado = 'activo'
group by c.id;

-- Mora por franjas: 0-30 / 31-60 / 61-90 / 90+
create or replace view reporteria.mora_por_franja
  with (security_invoker = true) as
select
  franja_mora,
  count(*) as creditos,
  sum(capital_pendiente_centavos)::bigint as capital_pendiente_centavos
from reporteria.cartera_por_credito
group by franja_mora;

-- Resumen ejecutivo: saldo total, cartera vencida e ICV
create or replace view reporteria.resumen_cartera
  with (security_invoker = true) as
select
  count(*) as creditos_activos,
  coalesce(sum(capital_pendiente_centavos), 0)::bigint
    as cartera_total_centavos,
  coalesce(sum(capital_pendiente_centavos) filter (where dias_mora > 0), 0)::bigint
    as cartera_vencida_centavos,
  -- ICV: índice de calidad de cartera = vencida / total
  round(
    coalesce(sum(capital_pendiente_centavos) filter (where dias_mora > 0), 0)::numeric
      / nullif(sum(capital_pendiente_centavos), 0),
    4
  ) as icv
from reporteria.cartera_por_credito;

-- Recaudo por mes, abierto por componente (mora / interés / capital)
create or replace view reporteria.recaudo_mensual
  with (security_invoker = true) as
select
  date_trunc('month', p.fecha_pago)::date as mes,
  count(distinct p.id) as pagos,
  sum(p.monto_centavos)::bigint as recaudo_centavos,
  coalesce(sum(a.monto_centavos) filter (where a.componente = 'mora'), 0)::bigint
    as mora_centavos,
  coalesce(sum(a.monto_centavos) filter (where a.componente = 'interes'), 0)::bigint
    as interes_centavos,
  coalesce(sum(a.monto_centavos) filter (where a.componente = 'capital'), 0)::bigint
    as capital_centavos
from cartera.pagos p
left join cartera.aplicaciones_pago a on a.pago_id = p.id
group by 1
order by 1;

-- Permisos: solo lectura
grant usage on schema reporteria to authenticated, service_role;
grant select on all tables in schema reporteria to authenticated, service_role;
alter default privileges in schema reporteria
  grant select on tables to authenticated, service_role;
