-- Enriquece clientes.clientes con datos que ya trae el escaneo de cédula
-- (mock hoy, mismo contrato con el proveedor real mañana): estrato de la
-- dirección y si la geolocalización del escaneo coincide con lo reportado.

alter table clientes.clientes
  add column estrato smallint check (estrato between 1 and 6),
  add column geo_coincide boolean;
