-- La pantalla "Mis solicitudes" del vendedor necesita contacto y contexto
-- para gestionar cada fila (ver en el wizard, llamar al cliente). Se agregan
-- columnas AL FINAL (create or replace exige no alterar las existentes).
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
  s.plazo_meses
from originacion.solicitudes s
left join clientes.clientes cl on cl.id = s.cliente_id
left join lateral (
  select resultado, cuota_estimada_centavos
  from originacion.decisiones
  where solicitud_id = s.id
  order by evaluado_en desc
  limit 1
) d on true
order by s.creado_en desc;
