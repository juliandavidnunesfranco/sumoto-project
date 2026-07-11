-- =============================================================================
-- Módulo clientes: base organizacional (public) + schema clientes con RLS
-- Decisión 2026-07-11: perfiles y tiendas viven en public (transversales).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Organización y seguridad (schema public)
-- -----------------------------------------------------------------------------

create type public.rol_usuario as enum (
  'vendedor', 'manager', 'financiero', 'contable', 'ceo'
);

create table public.tiendas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  ciudad     text not null,
  creado_en  timestamptz not null default now()
);

create table public.perfiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  rol        public.rol_usuario not null,
  -- vendedor y manager pertenecen a una tienda; financiero/contable/ceo son globales
  tienda_id  uuid references public.tiendas (id),
  nombre     text not null,
  creado_en  timestamptz not null default now(),
  constraint rol_de_tienda_requiere_tienda
    check (rol not in ('vendedor', 'manager') or tienda_id is not null)
);

-- Helpers para políticas RLS y middleware. SECURITY DEFINER: evita recursión de
-- RLS al consultar perfiles desde las propias políticas.
create or replace function public.rol_actual()
returns public.rol_usuario
language sql stable security definer
set search_path = public
as $$
  select rol from public.perfiles where user_id = auth.uid();
$$;

create or replace function public.tienda_actual()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select tienda_id from public.perfiles where user_id = auth.uid();
$$;

alter table public.tiendas enable row level security;
alter table public.perfiles enable row level security;

-- Tiendas: catálogo visible para todo usuario autenticado
create policy tiendas_lectura on public.tiendas
  for select to authenticated using (true);

-- Perfiles: cada quien ve el suyo; roles globales y manager ven todos (lectura)
create policy perfiles_lectura_propia on public.perfiles
  for select to authenticated
  using (user_id = auth.uid());

create policy perfiles_lectura_gestion on public.perfiles
  for select to authenticated
  using (public.rol_actual() in ('manager', 'financiero', 'contable', 'ceo'));

-- Escrituras en tiendas/perfiles: solo service_role (seeds/administración).

-- -----------------------------------------------------------------------------
-- 2. Schema del módulo clientes
-- -----------------------------------------------------------------------------

create schema if not exists clientes;

create table clientes.clientes (
  id                            uuid primary key default gen_random_uuid(),
  cedula                        text not null unique,
  nombres                       text not null,
  apellidos                     text not null,
  fecha_nacimiento              date,
  telefono                      text,
  email                         text,
  direccion                     text,
  ciudad                        text,
  -- dinero SIEMPRE en centavos enteros, nunca float
  ingresos_declarados_centavos  bigint check (ingresos_declarados_centavos >= 0),
  -- de dónde salieron los datos: 'escaner' | 'entrada_manual'
  fuente_identidad              text not null default 'entrada_manual'
                                check (fuente_identidad in ('escaner', 'entrada_manual')),
  -- tienda que registró al cliente (FK a public permitida; entre módulos no)
  tienda_id                     uuid not null references public.tiendas (id),
  creado_en                     timestamptz not null default now(),
  actualizado_en                timestamptz not null default now()
);

create index clientes_cedula_idx on clientes.clientes (cedula);
create index clientes_tienda_idx on clientes.clientes (tienda_id);

alter table clientes.clientes enable row level security;

-- Lectura: vendedor/manager solo su tienda; financiero/contable/ceo todo
create policy clientes_lectura on clientes.clientes
  for select to authenticated
  using (
    case public.rol_actual()
      when 'vendedor' then tienda_id = public.tienda_actual()
      when 'manager'  then tienda_id = public.tienda_actual()
      else public.rol_actual() is not null  -- financiero, contable, ceo
    end
  );

-- Registro: vendedor y manager, solo en su propia tienda
create policy clientes_registro on clientes.clientes
  for insert to authenticated
  with check (
    public.rol_actual() in ('vendedor', 'manager')
    and tienda_id = public.tienda_actual()
  );

-- Actualización: vendedor/manager de la tienda del cliente
create policy clientes_actualizacion on clientes.clientes
  for update to authenticated
  using (
    public.rol_actual() in ('vendedor', 'manager')
    and tienda_id = public.tienda_actual()
  );

-- -----------------------------------------------------------------------------
-- 3. Permisos de acceso al schema (PostgREST / supabase-js)
-- -----------------------------------------------------------------------------

grant usage on schema clientes to authenticated, service_role;
grant select, insert, update on all tables in schema clientes to authenticated;
grant all on all tables in schema clientes to service_role;
alter default privileges in schema clientes
  grant select, insert, update on tables to authenticated;
alter default privileges in schema clientes
  grant all on tables to service_role;
