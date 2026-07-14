-- =============================================================================
-- Módulo agenda: citas del manager (reuniones y visitas a clientes).
-- cliente_cedula es referencia SUAVE al módulo clientes (sin FK cruzada,
-- regla 3); tienda_id y creado_por sí llevan FK hacia public (permitido).
-- =============================================================================

create schema if not exists agenda;

create table agenda.citas (
  id              uuid primary key default gen_random_uuid(),
  tienda_id       uuid not null references public.tiendas (id),
  creado_por      uuid not null references public.perfiles (user_id),
  titulo          text not null check (length(trim(titulo)) > 0),
  tipo            text not null check (tipo in ('reunion', 'visita')),
  -- referencia suave a clientes.clientes.cedula (frontera de módulo)
  cliente_cedula  text,
  fecha_hora      timestamptz not null,
  notas           text,
  creado_en       timestamptz not null default now()
);

create index citas_tienda_fecha_idx on agenda.citas (tienda_id, fecha_hora);

alter table agenda.citas enable row level security;

-- vendedor/manager ven y agendan citas de SU tienda
create policy citas_lectura on agenda.citas
  for select to authenticated
  using (
    public.rol_actual() in ('financiero', 'contable', 'ceo')
    or tienda_id = public.tienda_actual()
  );

create policy citas_registro on agenda.citas
  for insert to authenticated
  with check (
    public.rol_actual() in ('vendedor', 'manager')
    and tienda_id = public.tienda_actual()
  );

-- grants explícitos (regla aprendida 2026-07-12: toda tabla los declara)
grant usage on schema agenda to authenticated, service_role;
grant select, insert on agenda.citas to authenticated;
grant all on all tables in schema agenda to service_role;
alter default privileges in schema agenda
  grant all on tables to service_role;
