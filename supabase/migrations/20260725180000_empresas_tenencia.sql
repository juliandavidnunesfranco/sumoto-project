-- =============================================================================
-- Fundación multi-tenant: tabla empresas (nivel transversal arriba de
-- tiendas/perfiles), empresa_id en tiendas/perfiles, función empresa_actual().
-- Ver docs/superpowers/specs/2026-07-25-saas-multitenant-foundation-design.md
-- sección 3. Esta migración NO toca ningún schema de módulo (eso es la
-- Tarea 3 de este plan, solo para `clientes`; el resto queda para el
-- siguiente plan de implementación).
-- =============================================================================

create table public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,
  plan       text not null default 'demo',
  estado     text not null default 'activa',
  creado_en  timestamptz not null default now()
);

alter table public.tiendas add column empresa_id uuid references public.empresas (id);
alter table public.perfiles add column empresa_id uuid references public.empresas (id);

-- Proyecto en fase demo: `supabase db reset` siembra desde cero en cada
-- corrida, no hay datos preexistentes que romper al exigir NOT NULL de una vez.
alter table public.tiendas alter column empresa_id set not null;
alter table public.perfiles alter column empresa_id set not null;

alter table public.empresas enable row level security;

-- Un usuario ve el nombre/plan de SU propia empresa, nunca el de otra.
create policy empresas_lectura on public.empresas
  for select to authenticated
  using (id = (select empresa_id from public.perfiles where user_id = auth.uid()));

create or replace function public.empresa_actual()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select empresa_id from public.perfiles where user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- FIX de fuga multi-tenant (existía antes de esta migración): cualquier
-- autenticado veía TODAS las tiendas, y financiero/contable/ceo veían TODOS
-- los perfiles, de CUALQUIER empresa.
-- -----------------------------------------------------------------------------

alter policy tiendas_lectura on public.tiendas
  using (empresa_id = public.empresa_actual());

alter policy perfiles_lectura_gestion on public.perfiles
  using (
    public.rol_actual() in ('manager', 'financiero', 'contable', 'ceo')
    and empresa_id = public.empresa_actual()
  );
