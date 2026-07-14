-- =============================================================================
-- Módulo catalogo: qué se financia (motos), separado de originacion
-- (políticas de crédito) — son conceptos distintos. Solo lectura desde la app.
-- =============================================================================

create schema if not exists catalogo;

create table catalogo.motos (
  id                        uuid primary key default gen_random_uuid(),
  nombre                    text not null,
  categoria                 text not null,
  imagen                    text not null,
  -- dinero SIEMPRE en centavos enteros, nunca float. Contado y crédito son
  -- precios DISTINTOS a propósito (no siempre coinciden).
  precio_contado_centavos   bigint not null check (precio_contado_centavos > 0),
  precio_credito_centavos   bigint not null check (precio_credito_centavos > 0),
  cilindraje                text not null,
  potencia                  text not null,
  frenos                    text not null,
  rendimiento               text not null,
  activo                    boolean not null default true,
  creado_en                 timestamptz not null default now()
);

-- Catálogo pequeño (decenas de filas): un índice btree simple alcanza, sin
-- necesidad de pg_trgm para el ILIKE de la búsqueda.
create index motos_nombre_idx on catalogo.motos (nombre);

alter table catalogo.motos enable row level security;

-- Catálogo compartido entre tiendas: cualquier usuario autenticado puede
-- buscar/listar motos (no hay datos sensibles ni scoping por tienda aquí).
create policy motos_lectura on catalogo.motos
  for select to authenticated
  using (true);

grant usage on schema catalogo to authenticated, service_role;
grant select on all tables in schema catalogo to authenticated;
grant all on all tables in schema catalogo to service_role;
alter default privileges in schema catalogo
  grant select on tables to authenticated;
alter default privileges in schema catalogo
  grant all on tables to service_role;
