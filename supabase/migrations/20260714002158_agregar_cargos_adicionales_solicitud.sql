-- Cargos adicionales (papelería, SOAT, etc.): los elige el vendedor por
-- solicitud, no son atributo fijo de la moto — se suman al monto a financiar.
alter table originacion.solicitudes
  add column cargos_adicionales_centavos bigint not null default 0
    check (cargos_adicionales_centavos >= 0);
