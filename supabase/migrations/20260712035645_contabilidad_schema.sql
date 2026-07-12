-- =============================================================================
-- Módulo contabilidad: asientos de partida doble generados por eventos.
-- El asiento nace de un evento (desembolso, pago) y se despacha a World Office
-- vía adaptador; si el despacho falla, queda 'pendiente' para reintento.
-- =============================================================================

create schema if not exists contabilidad;

create table contabilidad.asientos (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null,
  descripcion      text not null,
  -- trazabilidad: qué evento lo originó y a qué entidad refiere (sin FK cruzada)
  evento_origen    text not null,
  referencia_id    uuid not null,
  despacho         text not null default 'pendiente'
                   check (despacho in ('pendiente', 'despachado', 'fallido')),
  despacho_externo_id text,
  creado_en        timestamptz not null default now()
);

create index asientos_fecha_idx on contabilidad.asientos (fecha);
create index asientos_referencia_idx on contabilidad.asientos (referencia_id);
create index asientos_despacho_idx on contabilidad.asientos (despacho);

create table contabilidad.partidas (
  id               uuid primary key default gen_random_uuid(),
  asiento_id       uuid not null references contabilidad.asientos (id) on delete cascade,
  cuenta_codigo    text not null,
  cuenta_nombre    text not null,
  debito_centavos  bigint not null default 0 check (debito_centavos >= 0),
  credito_centavos bigint not null default 0 check (credito_centavos >= 0),
  -- una partida es débito O crédito, nunca ambos ni ninguno
  check (
    (debito_centavos > 0 and credito_centavos = 0)
    or (credito_centavos > 0 and debito_centavos = 0)
  )
);

create index partidas_asiento_idx on contabilidad.partidas (asiento_id);
create index partidas_cuenta_idx on contabilidad.partidas (cuenta_codigo);

-- -----------------------------------------------------------------------------
-- RLS: los asientos los ven contable, financiero y ceo; los escribe el sistema
-- (subscribers) — roles de gestión también pueden, para ajustes manuales futuros
-- -----------------------------------------------------------------------------

alter table contabilidad.asientos enable row level security;
alter table contabilidad.partidas enable row level security;

create policy asientos_lectura on contabilidad.asientos
  for select to authenticated
  using (public.rol_actual() in ('contable', 'financiero', 'ceo'));

create policy asientos_registro on contabilidad.asientos
  for insert to authenticated
  with check (public.rol_actual() in ('contable', 'financiero'));

create policy asientos_actualizacion on contabilidad.asientos
  for update to authenticated
  using (public.rol_actual() in ('contable', 'financiero'));

create policy partidas_lectura on contabilidad.partidas
  for select to authenticated
  using (public.rol_actual() in ('contable', 'financiero', 'ceo'));

create policy partidas_registro on contabilidad.partidas
  for insert to authenticated
  with check (public.rol_actual() in ('contable', 'financiero'));

-- -----------------------------------------------------------------------------
-- Permisos de acceso al schema (PostgREST / supabase-js)
-- -----------------------------------------------------------------------------

grant usage on schema contabilidad to authenticated, service_role;
grant select, insert, update on all tables in schema contabilidad to authenticated;
grant all on all tables in schema contabilidad to service_role;
alter default privileges in schema contabilidad
  grant select, insert, update on tables to authenticated;
alter default privileges in schema contabilidad
  grant all on tables to service_role;
