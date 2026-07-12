-- =============================================================================
-- GRANTs faltantes en el schema public (tiendas, perfiles).
-- Causa raíz del login roto: las tablas de public se crearon sin privilegios
-- SELECT para los roles de la API (error 42501). Los schemas de módulo ya los
-- tenían explícitos en sus migraciones; public no. service_role bypassa RLS
-- pero NO los privilegios de tabla — también los necesita.
-- =============================================================================

grant select on public.tiendas, public.perfiles to authenticated;
grant all on public.tiendas, public.perfiles to service_role;

-- las tablas futuras de public nacen con privilegios
alter default privileges in schema public
  grant select on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
