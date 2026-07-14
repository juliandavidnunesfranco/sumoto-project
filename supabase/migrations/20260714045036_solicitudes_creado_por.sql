-- Quién originó la solicitud (vendedor/manager). Columna plana con FK a
-- public.perfiles — MISMO patrón que tienda_id (FK módulo→public permitida;
-- la tabla links queda para relaciones nacidas de workflows, como
-- solicitud↔crédito). NOT NULL sin default: fase demo, sin datos vivos.
alter table originacion.solicitudes
  add column creado_por uuid not null references public.perfiles (user_id);

create index solicitudes_creado_por_idx on originacion.solicitudes (creado_por);

-- La vista gerencial expone al creador para que "Mis solicitudes" del
-- vendedor filtre por usuario (el manager sigue filtrando por tienda).
-- Columnas nuevas SIEMPRE al final (create or replace no altera las previas).
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
  s.creado_por
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
