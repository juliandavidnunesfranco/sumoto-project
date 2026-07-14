-- id corto de la solicitud como TEXTO (uuid no admite ilike): habilita la
-- búsqueda multi-columna "#a1b2c3d4" en las tablas. Columna AL FINAL.
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
  p.nombre as vendedor_nombre,
  left(s.id::text, 8) as solicitud_corta
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
