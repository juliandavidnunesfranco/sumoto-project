# Diseño: Fase 2 de multi-tenencia — `empresa_id`/`tienda_id` en los 5 módulos restantes

- Fecha: 2026-07-26
- Estado: aprobado por Julián, pendiente de plan de implementación
- Contexto: la fase 1 (2026-07-25) sentó la fundación (`public.empresas`,
  `empresa_actual()`, `empresa_id` en `tiendas`/`perfiles`) y migró
  `clientes` como patrón de referencia. El mismo día se cerró `reporteria`
  (spec propia: `2026-07-26-reporteria-empresa-id-design.md`) como una
  fuga de LECTURA sobre vistas. Esta spec cierra lo que queda: los 5
  módulos de negocio (`originacion`, `cartera`+`links`, `contabilidad`,
  `catalogo`, `agenda`) — 13 tablas en total, ninguna con `empresa_id`
  propio hoy (verificado contra la DB real, no supuesto).

## 0. Diferencia real con `reporteria`

`reporteria` es de SOLO LECTURA — su fuga era "¿qué se puede ver?". Estos
5 módulos tienen rutas de ESCRITURA reales (crear solicitud, desembolsar,
registrar pago, marcar verificación, generar asiento) — la pregunta ya no
es solo "¿qué se puede ver?" sino "¿qué se puede escribir con el
`empresa_id`/`tienda_id` equivocado?". Por eso esta fase introduce una
pieza que `reporteria` no necesitaba: **triggers de cascada con
validación** (sección 3), no solo el filtro explícito de lectura que ya
conocemos de `clientes`/`reporteria`.

## 1. Alcance

**Dentro:** las 13 tablas de `originacion`, `cartera`+`links`,
`contabilidad`, `catalogo`, `agenda`. Los servicios/repositorios
correspondientes de cada módulo (lectura: `empresaId` obligatorio como
primer parámetro, mismo criterio que `reporteria`). Los call sites del
backoffice que los consumen. RLS actualizada en las 13 tablas.

**Fuera (decisión explícita de Julián, 2026-07-26):** un concepto de
"regional" (nivel intermedio entre empresa y tienda) — no existe hoy en el
esquema (`public.tiendas` no tiene columna de región, no hay rol
"regional", no hay selector de tienda en las pantallas nacionales). Julián
confirmó que el filtrado nacional→tienda que ya existe vía `reporteria`
(`cartera_por_tienda`, parámetro `tiendaId` opcional en los métodos de
alcance nacional) es suficiente por ahora; una jerarquía "regional" queda
fuera de esta fase y de cualquier fase planeada.

## 2. Clasificación de las 13 tablas

Verificado contra `information_schema` real (FKs, columnas), no contra
memoria ni migraciones viejas.

**Grupo 1 — raíz con `tienda_id` ya propio** (`originacion.solicitudes`,
`cartera.creditos`, `agenda.citas`): solo ganan `empresa_id`, derivado por
trigger desde `tiendas.empresa_id` vía el `tienda_id` que la app ya setea.
Cero cambios en el código de escritura existente.

**Grupo 2 — hijas de un solo padre** (`originacion.decisiones`,
`originacion.verificaciones` ← `solicitudes`; `cartera.cuotas`,
`cartera.pagos` ← `creditos`; `contabilidad.partidas` ← `asientos`): ganan
`empresa_id` Y `tienda_id` (excepto `partidas`, ver abajo), derivados por
trigger desde el padre.

**Grupo 3 — doble padre** (`cartera.aplicaciones_pago` ← `pagos` Y
`cuotas`; `links.solicitud_credito` ← `solicitudes` Y `creditos`): el
trigger deriva de un padre y VALIDA que el segundo padre coincida —
rechaza si no (dato corrupto: un pago de un crédito aplicado a una cuota
de otro).

**Grupo 4 — raíz sin padre derivable** (`originacion.productos_credito`,
`catalogo.motos`): sin trigger posible. `empresa_id not null`, poblado por
la aplicación (dominio + repositorio + call site, mismo patrón que
`clientes.registrarCliente` en fase 1).

**Caso especial — `contabilidad.asientos` (y por herencia `partidas`,
Grupo 2 pero solo `empresa_id`, sin `tienda_id`):** no tiene FK real a
`cartera.creditos` (correcto — regla de "nunca FKs cruzadas entre
módulos", `referencia_id` es polimórfico). No se puede derivar por
trigger. El evento `cartera.credito.desembolsado` ya viaja con `tiendaId`
en el payload (verificado en `disburse-credit.ts:107-115`) — el
suscriptor de `contabilidad` (`subscribers/on-cartera-events.ts`) resuelve
`empresa_id` con una consulta propia a `public.tiendas` en el momento de
construir el asiento, sin tocar el workflow de `cartera` ni el dominio de
`Credito`. `contabilidad` es 100% alcance nacional (financiero/contable/
ceo, ninguna política existente distingue tienda) — por eso `asientos`/
`partidas` NO llevan `tienda_id`, solo `empresa_id`.

Este caso especial cierra, de paso, el gap `asientos_recientes` que la
spec de `reporteria` dejó documentado como pendiente de esta fase
(sección 1 y 9 de esa spec).

## 3. Mecanismo del trigger

Explícito por tabla, no genérico parametrizado (requeriría SQL dinámico
con `EXECUTE`, más difícil de auditar que 11 funciones pequeñas — decisión
tomada explícitamente sobre la alternativa, no por defecto). Deriva Y
valida: si la app ya mandó un valor y no coincide con el derivado del
padre, la transacción se rechaza con excepción — nunca corrección
silenciosa (decisión explícita de Julián: "validar y rechazar" sobre
"sobrescribir siempre").

Ejemplo (padre único, `cartera.cuotas` ← `creditos`):

```sql
create or replace function cartera.derivar_tenencia_cuota()
returns trigger as $$
declare
  v_empresa_id uuid;
  v_tienda_id uuid;
begin
  select empresa_id, tienda_id into v_empresa_id, v_tienda_id
  from cartera.creditos where id = new.credito_id;

  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de cuota (%) no coincide con el crédito padre (%)',
      new.empresa_id, v_empresa_id;
  end if;
  if new.tienda_id is not null and new.tienda_id <> v_tienda_id then
    raise exception 'tienda_id de cuota (%) no coincide con el crédito padre (%)',
      new.tienda_id, v_tienda_id;
  end if;

  new.empresa_id := v_empresa_id;
  new.tienda_id := v_tienda_id;
  return new;
end;
$$ language plpgsql;

create trigger cuotas_derivar_tenencia
  before insert on cartera.cuotas
  for each row execute function cartera.derivar_tenencia_cuota();
```

Ejemplo (doble padre, `cartera.aplicaciones_pago` ← `pagos` + `cuotas`):
deriva `empresa_id`/`tienda_id` de `pagos` vía `pago_id`, y además
compara contra lo derivado de `cuotas` vía `cuota_id` — si el crédito del
pago y el crédito de la cuota no son el mismo (o pertenecen a empresas
distintas), rechaza. Mismo esqueleto que el ejemplo de arriba, con una
segunda consulta y una segunda comparación antes de asignar `new.*`.

Los triggers SÍ corren con `service_role` (a diferencia de RLS, que ese sí
se bypassa) — el core no necesita ningún cambio para que esto funcione en
producción tal como está montado hoy.

## 4. RLS

Las 13 tablas YA tienen políticas por rol/tienda (verificado en
`solicitudes`/`creditos`: `CASE rol_actual() WHEN 'vendedor' THEN
tienda_id = tienda_actual() ...`) — pero ninguna conoce `empresa_id`
todavía, la misma clase de fuga que `tiendas_lectura`/
`perfiles_lectura_gestion` tenían antes de la fase 1. El trabajo:

1. Agregar `empresa_id = empresa_actual() AND (...)` a TODAS las
   políticas existentes de las 13 tablas.
2. Donde la política de hoy hace `EXISTS (select 1 from solicitudes
   where...)` (ej. `decisiones_lectura`, `verificaciones_lectura`),
   simplificarla a comparación directa de columna — ahora que esas tablas
   tienen su propio `empresa_id`/`tienda_id` denormalizado, ya no hace
   falta el join dentro de la política RLS (más simple, más rápido).
3. `catalogo.motos` hoy tiene `USING (true)` en lectura — cualquier
   autenticado ve motos de TODAS las empresas. Se acota a `empresa_id =
   empresa_actual()`.

## 5. Cambios de aplicación (dominio/repositorio/servicio)

**No necesitan cambio en el camino de ESCRITURA** las 10 tablas de los
grupos 1-3 (3 + 5 + 2): el trigger las completa. Los casos de uso/repositorios de
`originacion`/`cartera`/`agenda` que hoy hacen `.insert({...})` siguen
igual.

**Sí necesitan cambio de escritura** (Grupo 4 + caso especial):
- `originacion.productos_credito`: dominio (`DatosProducto`), repositorio
  y el caso de uso de creación ganan `empresaId` explícito desde
  `sesion.empresaId` — mismo patrón que `RegistrarCliente` en fase 1.
- `catalogo.motos`: igual, en el caso de uso/repositorio que crea motos.
- `contabilidad`: el suscriptor de eventos de cartera gana la consulta a
  `tiendas` descrita en la sección 2.

**Todos los métodos de LECTURA de los 5 módulos** ganan `empresaId` como
primer parámetro obligatorio con `.eq("empresa_id", empresaId)` — idéntico
al patrón ya usado en `reporteria` y `clientes`. El plan de implementación
enumera los métodos y call sites exactos módulo por módulo (no se listan
aquí para no arriesgar quedar desactualizados frente al código real al
momento de escribir el plan).

## 6. Testing

Tres capas — dos ya conocidas, una nueva:

1. **Aislamiento de repositorio** (patrón `aislamiento-tenant.e2e.test.ts`):
   confirma el filtro explícito de lectura, con control negativo.
2. **Aislamiento RLS** (patrón `aislamiento-rls.e2e.test.ts`): login real
   con `anon key`, confirma que las políticas por sí solas bloquean el
   cruce, con RLS desactivada a propósito como control negativo.
3. **Validación del trigger (NUEVA):** insertar una fila hija con un
   padre real pero un `empresa_id`/`tienda_id` deliberadamente
   incoherente (simulando datos corruptos) y confirmar que Postgres
   RECHAZA el insert con la excepción — incluyendo el caso de doble padre
   (`aplicaciones_pago` con `pago`/`cuota` de créditos distintos).

Cada módulo del plan de implementación trae su propia suite (mismo
criterio de alcance que usó `reporteria`: un archivo `.e2e.test.ts` por
módulo o uno consolidado si el tamaño lo justifica — a decidir en el
plan).

## 7. Migraciones

**Orden dentro de cada módulo** (importa — dependencias reales):
1. Agregar columnas como NULLABLE.
2. Backfill: `UPDATE` una sola vez sobre las filas YA existentes en la DB
   local (no se pierde nada — misma lógica conservadora usada para
   `reporteria`, sin `db reset`).
3. Crear función + trigger.
4. `ALTER COLUMN ... SET NOT NULL`.
5. Actualizar políticas RLS (sección 4).

**Orden entre módulos** (coincide con lo insinuado en `docs/STATUS.md`, y
además con una dependencia real — `links.solicitud_credito` necesita que
`originacion` Y `cartera` ya tengan `empresa_id`):

`originacion` (solicitudes → decisiones/verificaciones → productos_credito)
→ `cartera` + `links` (creditos → cuotas/pagos → aplicaciones_pago →
links.solicitud_credito) → `contabilidad` (asientos vía suscriptor →
partidas) → `catalogo` (motos) → `agenda` (citas).

**`seed.sql`:** no se toca para las 11 tablas con trigger — se completan
solas al insertar (los triggers corren con `service_role`). Solo
`productos_credito` y `motos` necesitan una línea con `empresa_id`
explícito apuntando a la empresa SUMOTO del seed
(`d0000000-0000-4000-8000-000000000001`).

## 8. Riesgos y decisiones pendientes (fuera de esta spec)

- El gap `asientos_recientes` que dejó pendiente la spec de `reporteria`
  se cierra DENTRO de esta fase (sección 2, caso especial) — no queda
  ningún pendiente cruzado entre las dos specs al terminar este plan.
- Una vez que `cartera`/`originacion` tengan `empresa_id` propio, las 8
  vistas de `reporteria` podrían simplificarse para leer `empresa_id`
  directo de esas tablas en vez de vía join a `tiendas` (mencionado como
  optimización futura opcional en la sección 9 de esa spec) — no es
  necesario para esta fase, el join sigue funcionando.
- "Regional" (sección 1) queda fuera de cualquier fase planeada por ahora.

## 9. Próximos pasos

Alcance acotado, mecanismo de trigger decidido (explícito, validar y
rechazar), y el único punto de ambigüedad de negocio (regional) ya
resuelto por Julián. Pasa a `superpowers:writing-plans` para un plan de
implementación único con los 5 módulos como tareas secuenciales,
ejecutado con `subagent-driven-development` dado el tamaño (13 tablas,
10 triggers, 5 módulos de servicio/repositorio, RLS en 13 tablas, 3 capas
de testing).
