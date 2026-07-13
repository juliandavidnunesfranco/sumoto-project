-- =============================================================================
-- financiero crea productos de crédito y administra sus políticas de decisión.
-- El core usa service_role (bypasa RLS), pero se documentan las políticas para
-- defensa en profundidad y para el futuro cliente por-request con JWT.
-- =============================================================================

create policy productos_registro on originacion.productos_credito
  for insert to authenticated
  with check (public.rol_actual() = 'financiero');

create policy productos_actualizacion on originacion.productos_credito
  for update to authenticated
  using (public.rol_actual() = 'financiero');
