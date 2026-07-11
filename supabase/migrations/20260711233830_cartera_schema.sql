-- =============================================================================
-- Módulo cartera: créditos, cuotas, pagos y aplicaciones de pago.
-- Primer uso del schema links (patrón Module Links): solicitud ↔ crédito,
-- SIN foreign keys hacia los schemas de origen (regla 3).
-- =============================================================================

create schema if not exists cartera;
create schema if not exists links;

create table cartera.creditos (
  id                          uuid primary key default gen_random_uuid(),
  -- vive en schema clientes: referencia sin FK (frontera de módulo)
  cliente_id                  uuid not null,
  tienda_id                   uuid not null references public.tiendas (id),
  monto_desembolsado_centavos bigint not null check (monto_desembolsado_centavos > 0),
  -- snapshot de condiciones al desembolso (el producto puede cambiar después)
  tasa_ea                     numeric(8, 5) not null check (tasa_ea >= 0),
  tasa_mora_ea                numeric(8, 5) not null check (tasa_mora_ea >= 0),
  plazo_meses                 int not null check (plazo_meses > 0),
  cuota_centavos              bigint not null check (cuota_centavos > 0),
  estado                      text not null default 'activo'
                              check (estado in ('activo', 'cancelado')),
  desembolsado_en             date not null,
  creado_en                   timestamptz not null default now()
);

create index creditos_cliente_idx on cartera.creditos (cliente_id);
create index creditos_tienda_idx on cartera.creditos (tienda_id);

create table cartera.cuotas (
  id                        uuid primary key default gen_random_uuid(),
  credito_id                uuid not null references cartera.creditos (id) on delete cascade,
  numero                    int not null check (numero > 0),
  fecha_vencimiento         date not null,
  capital_centavos          bigint not null check (capital_centavos >= 0),
  interes_centavos          bigint not null check (interes_centavos >= 0),
  capital_pagado_centavos   bigint not null default 0 check (capital_pagado_centavos >= 0),
  interes_pagado_centavos   bigint not null default 0 check (interes_pagado_centavos >= 0),
  mora_pagada_centavos      bigint not null default 0 check (mora_pagada_centavos >= 0),
  unique (credito_id, numero)
);

create index cuotas_credito_idx on cartera.cuotas (credito_id);
create index cuotas_vencimiento_idx on cartera.cuotas (fecha_vencimiento);

create table cartera.pagos (
  id                 uuid primary key default gen_random_uuid(),
  credito_id         uuid not null references cartera.creditos (id),
  monto_centavos     bigint not null check (monto_centavos > 0),
  sobrante_centavos  bigint not null default 0 check (sobrante_centavos >= 0),
  fecha_pago         date not null,
  creado_en          timestamptz not null default now()
);

create index pagos_credito_idx on cartera.pagos (credito_id);

-- Rastro exacto de a qué cuota y componente fue cada peso (auditoría contable)
create table cartera.aplicaciones_pago (
  id              uuid primary key default gen_random_uuid(),
  pago_id         uuid not null references cartera.pagos (id) on delete cascade,
  cuota_id        uuid not null references cartera.cuotas (id),
  componente      text not null check (componente in ('mora', 'interes', 'capital')),
  monto_centavos  bigint not null check (monto_centavos > 0)
);

create index aplicaciones_pago_idx on cartera.aplicaciones_pago (pago_id);
create index aplicaciones_cuota_idx on cartera.aplicaciones_pago (cuota_id);

-- Enlace entre módulos: qué crédito nació de qué solicitud (sin FKs cruzadas)
create table links.solicitud_credito (
  solicitud_id  uuid not null,
  credito_id    uuid not null,
  creado_en     timestamptz not null default now(),
  primary key (solicitud_id, credito_id)
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table cartera.creditos enable row level security;
alter table cartera.cuotas enable row level security;
alter table cartera.pagos enable row level security;
alter table cartera.aplicaciones_pago enable row level security;
alter table links.solicitud_credito enable row level security;

-- Créditos: vendedor/manager por tienda; financiero/contable/ceo todo
create policy creditos_lectura on cartera.creditos
  for select to authenticated
  using (
    case public.rol_actual()
      when 'vendedor' then tienda_id = public.tienda_actual()
      when 'manager'  then tienda_id = public.tienda_actual()
      else public.rol_actual() is not null
    end
  );

-- Desembolsos y pagos los ejecutan roles de gestión de cartera
create policy creditos_registro on cartera.creditos
  for insert to authenticated
  with check (public.rol_actual() in ('manager', 'financiero'));

-- Cuotas/pagos/aplicaciones: visibilidad heredada del crédito
create policy cuotas_lectura on cartera.cuotas
  for select to authenticated
  using (exists (select 1 from cartera.creditos c where c.id = credito_id));

create policy cuotas_registro on cartera.cuotas
  for insert to authenticated
  with check (public.rol_actual() in ('manager', 'financiero'));

create policy cuotas_actualizacion on cartera.cuotas
  for update to authenticated
  using (public.rol_actual() in ('manager', 'financiero'));

create policy pagos_lectura on cartera.pagos
  for select to authenticated
  using (exists (select 1 from cartera.creditos c where c.id = credito_id));

create policy pagos_registro on cartera.pagos
  for insert to authenticated
  with check (public.rol_actual() in ('vendedor', 'manager', 'financiero'));

create policy aplicaciones_lectura on cartera.aplicaciones_pago
  for select to authenticated
  using (exists (select 1 from cartera.pagos p where p.id = pago_id));

create policy aplicaciones_registro on cartera.aplicaciones_pago
  for insert to authenticated
  with check (public.rol_actual() in ('vendedor', 'manager', 'financiero'));

-- Links: lectura para autenticados con perfil; escritura de gestión
create policy links_sc_lectura on links.solicitud_credito
  for select to authenticated using (public.rol_actual() is not null);

create policy links_sc_registro on links.solicitud_credito
  for insert to authenticated
  with check (public.rol_actual() in ('manager', 'financiero'));

-- -----------------------------------------------------------------------------
-- Permisos de acceso a los schemas (PostgREST / supabase-js)
-- -----------------------------------------------------------------------------

grant usage on schema cartera to authenticated, service_role;
grant select, insert, update on all tables in schema cartera to authenticated;
grant all on all tables in schema cartera to service_role;
alter default privileges in schema cartera
  grant select, insert, update on tables to authenticated;
alter default privileges in schema cartera
  grant all on tables to service_role;

grant usage on schema links to authenticated, service_role;
grant select, insert, delete on all tables in schema links to authenticated;
grant all on all tables in schema links to service_role;
alter default privileges in schema links
  grant select, insert, delete on tables to authenticated;
alter default privileges in schema links
  grant all on tables to service_role;
