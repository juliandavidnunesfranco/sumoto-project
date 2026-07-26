-- =============================================================================
-- reporteria: empresa_id en las 8 vistas con camino a public.tiendas.
-- asientos_recientes queda FUERA (gap documentado, se cierra con la fase 2
-- de cartera+contabilidad — ver spec 2026-07-26-reporteria-empresa-id-design.md).
-- =============================================================================

create or replace view reporteria.cartera_por_credito
  with (security_invoker = true) as
select
  c.id as credito_id,
  c.cliente_id,
  c.tienda_id,
  t.empresa_id,
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
join public.tiendas t on t.id = c.tienda_id
where c.estado = 'activo'
group by c.id, t.empresa_id;

create or replace view reporteria.mora_por_franja
  with (security_invoker = true) as
select
  empresa_id,
  franja_mora,
  count(*) as creditos,
  sum(capital_pendiente_centavos)::bigint as capital_pendiente_centavos
from reporteria.cartera_por_credito
group by empresa_id, franja_mora;

create or replace view reporteria.resumen_cartera
  with (security_invoker = true) as
select
  empresa_id,
  count(*) as creditos_activos,
  coalesce(sum(capital_pendiente_centavos), 0)::bigint
    as cartera_total_centavos,
  coalesce(sum(capital_pendiente_centavos) filter (where dias_mora > 0), 0)::bigint
    as cartera_vencida_centavos,
  round(
    coalesce(sum(capital_pendiente_centavos) filter (where dias_mora > 0), 0)::numeric
      / nullif(sum(capital_pendiente_centavos), 0),
    4
  ) as icv
from reporteria.cartera_por_credito
group by empresa_id;

create or replace view reporteria.recaudo_mensual
  with (security_invoker = true) as
select
  t.empresa_id,
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
join cartera.creditos c on c.id = p.credito_id
join public.tiendas t on t.id = c.tienda_id
left join cartera.aplicaciones_pago a on a.pago_id = p.id
group by t.empresa_id, date_trunc('month', p.fecha_pago)
order by date_trunc('month', p.fecha_pago);

create or replace view reporteria.cartera_por_tienda
  with (security_invoker = true) as
select
  t.id as tienda_id,
  t.empresa_id,
  t.nombre as tienda_nombre,
  count(cc.credito_id) as creditos_activos,
  coalesce(sum(cc.capital_pendiente_centavos), 0)::bigint as capital_total_centavos,
  coalesce(sum(cc.capital_pendiente_centavos) filter (where cc.dias_mora > 0), 0)::bigint
    as capital_vencido_centavos,
  t.meta_colocacion_centavos
from public.tiendas t
left join reporteria.cartera_por_credito cc on cc.tienda_id = t.id
group by t.id, t.empresa_id, t.nombre, t.meta_colocacion_centavos;

create or replace view reporteria.solicitudes_recientes
  with (security_invoker = true) as
select
  s.id as solicitud_id,
  s.tienda_id,
  t.empresa_id,
  s.creado_en,
  s.valor_moto_centavos,
  s.estado,
  cl.nombres || ' ' || cl.apellidos as cliente_nombre,
  d.resultado as decision_resultado,
  d.cuota_estimada_centavos,
  cl.cedula as cliente_cedula,
  cl.telefono as cliente_telefono,
  s.plazo_meses,
  s.creado_por,
  m.nombre as moto_nombre,
  p.nombre as vendedor_nombre,
  left(s.id::text, 8) as solicitud_corta
from originacion.solicitudes s
join public.tiendas t on t.id = s.tienda_id
left join clientes.clientes cl on cl.id = s.cliente_id
left join catalogo.motos m on m.id = s.moto_id
left join public.perfiles p on p.user_id = s.creado_por
left join lateral (
  select resultado, cuota_estimada_centavos
  from originacion.decisiones
  where solicitud_id = s.id
  order by evaluado_en desc
  limit 1
) d on true
order by s.creado_en desc;

create or replace view reporteria.desempeno_vendedores
  with (security_invoker = true) as
select
  s.tienda_id,
  t.empresa_id,
  s.creado_por,
  p.nombre as vendedor_nombre,
  count(*)::int as solicitudes,
  count(*) filter (where d.resultado = 'APROBADO')::int as aprobadas,
  coalesce(sum(cr.monto_desembolsado_centavos), 0)::bigint as colocacion_centavos
from originacion.solicitudes s
join public.tiendas t on t.id = s.tienda_id
join public.perfiles p on p.user_id = s.creado_por
left join lateral (
  select resultado from originacion.decisiones
  where solicitud_id = s.id
  order by evaluado_en desc
  limit 1
) d on true
left join links.solicitud_credito lk on lk.solicitud_id = s.id
left join cartera.creditos cr on cr.id = lk.credito_id
group by s.tienda_id, t.empresa_id, s.creado_por, p.nombre;

create or replace view reporteria.colocacion_diaria
  with (security_invoker = true) as
select
  c.tienda_id,
  t.empresa_id,
  c.desembolsado_en as fecha,
  count(*)::int as creditos,
  sum(c.monto_desembolsado_centavos)::bigint as monto_centavos
from cartera.creditos c
join public.tiendas t on t.id = c.tienda_id
group by c.tienda_id, t.empresa_id, c.desembolsado_en;
