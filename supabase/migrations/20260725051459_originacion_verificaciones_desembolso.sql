-- Verificación pre-desembolso (etapa de otorgamiento del expediente, SARC):
-- marcas del checklist por solicitud + bucket privado para los documentos
-- aportados por el solicitante. El catálogo de ítems vive en el DOMINIO
-- (packages/core/modules/originacion/domain/verificacion.ts) — aquí solo se
-- persisten las marcas: la base no decide qué ítems existen.

-- -----------------------------------------------------------------------------
-- Tabla de marcas
-- -----------------------------------------------------------------------------

create table originacion.verificaciones (
  solicitud_id uuid        not null,  -- FK dentro del MISMO módulo (permitida)
  item_codigo  text        not null,
  marcado      boolean     not null default true,
  -- quién verificó (auth.users.id): trazabilidad exigible en el expediente
  marcado_por  uuid        not null,
  marcado_en   timestamptz not null default now(),
  primary key (solicitud_id, item_codigo),
  constraint verificaciones_solicitud_fk
    foreign key (solicitud_id) references originacion.solicitudes (id) on delete cascade
);

comment on table originacion.verificaciones is
  'Marcas del checklist pre-desembolso (expediente de crédito). El catálogo de ítems es del dominio.';

-- -----------------------------------------------------------------------------
-- RLS: el financiero administra el expediente; los demás roles pueden verlo
-- (manager/vendedor solo si la solicitud es de su tienda)
-- -----------------------------------------------------------------------------

alter table originacion.verificaciones enable row level security;

create policy verificaciones_lectura on originacion.verificaciones
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

create policy verificaciones_registro on originacion.verificaciones
  for insert to authenticated
  with check (public.rol_actual() = 'financiero');

create policy verificaciones_actualizacion on originacion.verificaciones
  for update to authenticated
  using (public.rol_actual() = 'financiero');

-- grants explícitos (regla aprendida 2026-07-12: toda migración que crea
-- tablas declara sus grants — los default privileges del schema ya cubren
-- select/insert/update para authenticated, esto lo hace visible y completo)
grant select, insert, update on originacion.verificaciones to authenticated;
grant all on originacion.verificaciones to service_role;

-- -----------------------------------------------------------------------------
-- Bucket PRIVADO para documentos del expediente (sin políticas en
-- storage.objects: nadie entra por la API pública; el core accede con
-- service_role — dos puertas, igual que el resto)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  5242880, -- 5 MiB
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;
