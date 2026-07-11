-- =============================================================================
-- Módulo originacion: productos de crédito, solicitudes y decisiones.
-- Referencias a clientes (otro módulo) por uuid SIN foreign key (regla 3);
-- FKs internas del schema y hacia public sí van.
-- =============================================================================

create schema if not exists originacion;

-- Productos de crédito: las reglas de decisión son parametrizables (JSONB)
create table originacion.productos_credito (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  -- tasa efectiva anual como fracción exacta (ej: 0.24500 = 24.5% EA), nunca float
  tasa_ea           numeric(8, 5) not null check (tasa_ea >= 0),
  plazo_min_meses   int not null check (plazo_min_meses > 0),
  plazo_max_meses   int not null check (plazo_max_meses >= plazo_min_meses),
  -- reglas del motor de decisión, ej:
  -- { "score_minimo": 600, "score_revision": 650,
  --   "cuota_maxima_porcentaje_ingreso": 0.35, "ltv_maximo": 0.90,
  --   "ingreso_minimo_centavos": 130000000, "mora_maxima_dias": 60 }
  reglas_decision   jsonb not null,
  activo            boolean not null default true,
  creado_en         timestamptz not null default now()
);

create table originacion.solicitudes (
  id                             uuid primary key default gen_random_uuid(),
  -- vive en schema clientes: referencia sin FK (frontera de módulo)
  cliente_id                     uuid not null,
  producto_id                    uuid not null references originacion.productos_credito (id),
  tienda_id                      uuid not null references public.tiendas (id),
  valor_moto_centavos            bigint not null check (valor_moto_centavos > 0),
  cuota_inicial_centavos         bigint not null check (cuota_inicial_centavos >= 0),
  plazo_meses                    int not null check (plazo_meses > 0),
  ingresos_declarados_centavos   bigint not null check (ingresos_declarados_centavos > 0),
  estado                         text not null default 'pendiente'
                                 check (estado in
                                   ('pendiente', 'evaluada', 'desembolsada')),
  creado_en                      timestamptz not null default now()
);

create index solicitudes_cliente_idx on originacion.solicitudes (cliente_id);
create index solicitudes_tienda_idx on originacion.solicitudes (tienda_id);
create index solicitudes_estado_idx on originacion.solicitudes (estado);

-- Decisión del motor: inmutable, con razones visibles (explicabilidad = requisito)
create table originacion.decisiones (
  id                  uuid primary key default gen_random_uuid(),
  solicitud_id        uuid not null references originacion.solicitudes (id),
  resultado           text not null
                      check (resultado in ('APROBADO', 'NEGADO', 'REVISION_MANUAL')),
  razones             jsonb not null default '[]'::jsonb,
  score               int,
  -- snapshot del reporte de riesgo YA traducido al dominio (auditoría)
  reporte_riesgo      jsonb,
  cuota_estimada_centavos bigint,
  evaluado_en         timestamptz not null default now()
);

create index decisiones_solicitud_idx on originacion.decisiones (solicitud_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table originacion.productos_credito enable row level security;
alter table originacion.solicitudes enable row level security;
alter table originacion.decisiones enable row level security;

-- Catálogo de productos: visible para todo usuario autenticado con perfil
create policy productos_lectura on originacion.productos_credito
  for select to authenticated
  using (public.rol_actual() is not null);

-- Solicitudes: vendedor/manager por tienda; financiero/contable/ceo todo
create policy solicitudes_lectura on originacion.solicitudes
  for select to authenticated
  using (
    case public.rol_actual()
      when 'vendedor' then tienda_id = public.tienda_actual()
      when 'manager'  then tienda_id = public.tienda_actual()
      else public.rol_actual() is not null
    end
  );

create policy solicitudes_registro on originacion.solicitudes
  for insert to authenticated
  with check (
    public.rol_actual() in ('vendedor', 'manager')
    and tienda_id = public.tienda_actual()
  );

create policy solicitudes_actualizacion on originacion.solicitudes
  for update to authenticated
  using (
    public.rol_actual() in ('vendedor', 'manager')
    and tienda_id = public.tienda_actual()
  );

-- Decisiones: mismas visibilidades que la solicitud a la que pertenecen
create policy decisiones_lectura on originacion.decisiones
  for select to authenticated
  using (
    exists (
      select 1 from originacion.solicitudes s
      where s.id = solicitud_id
        and (
          case public.rol_actual()
            when 'vendedor' then s.tienda_id = public.tienda_actual()
            when 'manager'  then s.tienda_id = public.tienda_actual()
            else public.rol_actual() is not null
          end
        )
    )
  );

create policy decisiones_registro on originacion.decisiones
  for insert to authenticated
  with check (
    public.rol_actual() in ('vendedor', 'manager')
    and exists (
      select 1 from originacion.solicitudes s
      where s.id = solicitud_id and s.tienda_id = public.tienda_actual()
    )
  );

-- -----------------------------------------------------------------------------
-- Permisos de acceso al schema (PostgREST / supabase-js)
-- -----------------------------------------------------------------------------

grant usage on schema originacion to authenticated, service_role;
grant select, insert, update on all tables in schema originacion to authenticated;
grant all on all tables in schema originacion to service_role;
alter default privileges in schema originacion
  grant select, insert, update on tables to authenticated;
alter default privileges in schema originacion
  grant all on tables to service_role;
