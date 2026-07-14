-- Vistas gerenciales del manager (estilo v0, con datos REALES):
-- desempeño por vendedor, colocación diaria y solicitudes con moto/vendedor.

-- Desempeño por vendedor: solicitudes originadas, aprobadas y colocación
-- (montos desembolsados de créditos nacidos de SUS solicitudes, vía links).
create or replace view reporteria.desempeno_vendedores
  with (security_invoker = true) as
select
  s.tienda_id,
  s.creado_por,
  p.nombre as vendedor_nombre,
  count(*)::int as solicitudes,
  count(*) filter (where d.resultado = 'APROBADO')::int as aprobadas,
  coalesce(sum(cr.monto_desembolsado_centavos), 0)::bigint as colocacion_centavos
from originacion.solicitudes s
join public.perfiles p on p.user_id = s.creado_por
left join lateral (
  select resultado from originacion.decisiones
  where solicitud_id = s.id
  order by evaluado_en desc
  limit 1
) d on true
left join links.solicitud_credito lk on lk.solicitud_id = s.id
left join cartera.creditos cr on cr.id = lk.credito_id
group by s.tienda_id, s.creado_por, p.nombre;

-- Colocación diaria por tienda: seguimiento del manager (calendario y
-- gráfico mensual se agregan encima de esta serie).
create or replace view reporteria.colocacion_diaria
  with (security_invoker = true) as
select
  tienda_id,
  desembolsado_en as fecha,
  count(*)::int as creditos,
  sum(monto_desembolsado_centavos)::bigint as monto_centavos
from cartera.creditos
group by tienda_id, desembolsado_en;

-- Solicitudes recientes: se agregan moto y vendedor (columnas AL FINAL).
create or replace view reporteria.solicitudes_recientes
  with (security_invoker = true) as
select
  s.id as solicitud_id,
  s.tienda_id,
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
  p.nombre as vendedor_nombre
from originacion.solicitudes s
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

grant select on reporteria.desempeno_vendedores to authenticated, service_role;
grant select on reporteria.colocacion_diaria to authenticated, service_role;
