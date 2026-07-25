-- =============================================================================
-- empresa_id en clientes.clientes — primer módulo migrado como referencia
-- del patrón (ver spec sección 3). El resto de módulos sigue en un plan
-- de implementación separado.
-- =============================================================================

-- La cédula deja de ser única GLOBALMENTE: dos empresas distintas pueden
-- tener cada una un cliente con la misma cédula (negocios independientes).
-- Debe quedar única POR EMPRESA. Drop antes de agregar la columna nueva.
alter table clientes.clientes drop constraint clientes_cedula_key;

alter table clientes.clientes add column empresa_id uuid references public.empresas (id);
alter table clientes.clientes alter column empresa_id set not null;

alter table clientes.clientes add constraint clientes_cedula_empresa_key unique (cedula, empresa_id);

create index clientes_empresa_idx on clientes.clientes (empresa_id);

alter policy clientes_lectura on clientes.clientes
  using (
    empresa_id = public.empresa_actual()
    and case public.rol_actual()
      when 'vendedor' then tienda_id = public.tienda_actual()
      when 'manager'  then tienda_id = public.tienda_actual()
      else public.rol_actual() is not null
    end
  );

alter policy clientes_registro on clientes.clientes
  with check (
    empresa_id = public.empresa_actual()
    and public.rol_actual() in ('vendedor', 'manager')
    and tienda_id = public.tienda_actual()
  );

alter policy clientes_actualizacion on clientes.clientes
  using (
    empresa_id = public.empresa_actual()
    and public.rol_actual() in ('vendedor', 'manager')
    and tienda_id = public.tienda_actual()
  );
