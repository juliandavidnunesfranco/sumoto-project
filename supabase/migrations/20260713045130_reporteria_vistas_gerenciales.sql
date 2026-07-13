-- =============================================================================
-- Vistas de reporteria para manager, contable y ceo. Mismo patrón: solo
-- lectura, security_invoker, sin domain. Datos reales, cero mocks en la app.
-- =============================================================================

-- Cartera agregada por tienda: base para el "resumen de tienda" del manager
-- y el ranking de tiendas del ceo.
create or replace view reporteria.cartera_por_tienda
  with (security_invoker = true) as
select
  t.id as tienda_id,
  t.nombre as tienda_nombre,
  count(cc.credito_id) as creditos_activos,
  coalesce(sum(cc.capital_pendiente_centavos), 0)::bigint as capital_total_centavos,
  coalesce(sum(cc.capital_pendiente_centavos) filter (where cc.dias_mora > 0), 0)::bigint
    as capital_vencido_centavos
from public.tiendas t
left join reporteria.cartera_por_credito cc on cc.tienda_id = t.id
group by t.id, t.nombre;

-- Solicitudes recientes con su decisión: para el manager (su tienda) y el
-- vendedor ("mis solicitudes" a futuro).
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
  d.cuota_estimada_centavos
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

-- Últimos asientos contables con sus totales: para la pantalla de contable.
create or replace view reporteria.asientos_recientes
  with (security_invoker = true) as
select
  a.id as asiento_id,
  a.fecha,
  a.descripcion,
  a.evento_origen,
  a.despacho,
  coalesce(sum(p.debito_centavos), 0)::bigint as total_debito_centavos,
  coalesce(sum(p.credito_centavos), 0)::bigint as total_credito_centavos
from contabilidad.asientos a
left join contabilidad.partidas p on p.asiento_id = a.id
group by a.id, a.fecha, a.descripcion, a.evento_origen, a.despacho
order by a.fecha desc, a.creado_en desc;

-- Permisos: solo lectura, mismo patrón que el resto de reporteria
grant select on reporteria.cartera_por_tienda to authenticated, service_role;
grant select on reporteria.solicitudes_recientes to authenticated, service_role;
grant select on reporteria.asientos_recientes to authenticated, service_role;
