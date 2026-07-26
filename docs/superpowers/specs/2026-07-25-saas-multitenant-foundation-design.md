# Diseño: fundación multi-tenant y genérica de producto/política para SUMOTO SaaS

- Fecha: 2026-07-25
- Estado: aprobado por Julián, pendiente de plan de implementación
- Autor de la sesión: Claude (brainstorming), decisiones de Julián Núñez

## 1. Contexto y motivación

SUMOTO nació como demo de un solo cliente (SUMOTO, retail de motos) sobre un
monolito modular estilo Medusa v2, con `tiendas`/`perfiles` como único nivel
de multiplicidad organizacional. Julián quiere convertirlo en un producto
vendible por suscripción desde su sitio web: **cada empresa-cliente usa su
propia instancia lógica del sistema**, y el negocio deja de ser
exclusivamente motos — cualquier empresa debe poder dar crédito sobre
cualquier tipo de producto o servicio que venda.

Esto no es "agregar features": introduce un nivel de multiplicidad nuevo
(la empresa-cliente, "tenant") por encima de tienda, y generaliza dos
conceptos que hoy están cableados a motos/crédito-de-motos: el catálogo de
lo que se financia y el motor de reglas de decisión crediticia.

## 2. Alcance de esta spec

**Dentro de alcance** (la base de la que depende todo lo demás):
1. Modelo de tenencia y aislamiento entre empresas.
2. Catálogo de productos/servicios genérico (reemplaza `catalogo.motos`).
3. Motor de políticas de crédito configurable por empresa (reemplaza
   `ReglasDecision` fija).
4. RBAC configurable dentro de los 5 roles fijos de la plataforma.
5. Auditoría genérica de cambios (tomando ideas del repo de referencia).
6. Migración de los datos actuales de SUMOTO al nuevo modelo.

**Explícitamente fuera de alcance de esta spec** (dependen de esta base,
se diseñan después, cada uno con su propia sesión):
- Navegación del sidebar para cientos de productos/políticas (submenú
  actual no escala — se resuelve una vez exista el catálogo genérico).
- Acciones del financiero para validar información del solicitante
  (geolocalización, tipo de contrato, tiempo en la empresa) como *workflow*
  de UI — los campos en sí ya quedan cubiertos como criterios evaluables
  (sección 5), pero la pantalla/acción de validación manual es una pieza
  de UX aparte.
- Roles verdaderamente dinámicos por empresa (ej. "Cobrador" con su propia
  navegación) — decisión explícita de Julián: los 5 roles quedan fijos por
  ahora; ver sección 6 para lo que sí se configura.
- Suscripción/billing (cobro de la propia plataforma a sus empresas-cliente),
  onboarding de autoservicio desde el sitio web, y aprovisionamiento
  automático de una empresa nueva. Estas son piezas de negocio/infra
  independientes de la arquitectura de datos — se diseñan aparte.
- El hallazgo del flujo de aprobación (`wizard` dispara `APROBADO` y salta a
  documentación antes de que financiero revise) — Julián confirmó que no
  es arquitectónico y que no se aborda en esta sesión.

## 3. Modelo de tenencia y aislamiento

**Decisión:** RLS de fila con `empresa_id`, **no** schema-por-tenant.

`public.empresas` (id, nombre, slug, plan, estado, creado_en) — transversal,
mismo criterio que ya aplica a `tiendas`/`perfiles` (decisión 2026-07-11: no
pertenecen a ningún módulo, son seguridad/estructura organizacional).

```sql
create table public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,
  plan       text not null default 'demo',
  estado     text not null default 'activa',
  creado_en  timestamptz not null default now()
);

alter table public.tiendas add column empresa_id uuid not null references public.empresas(id);
alter table public.perfiles add column empresa_id uuid not null references public.empresas(id);
```

`perfiles.empresa_id` se agrega **directo**, no derivado vía `tiendas`,
porque roles como `contable`/`ceo`/`financiero` ya operan cruzando tiendas
de una misma empresa (ej. `cartera_por_tienda`) — necesitan resolver su
empresa sin depender de tener una tienda asignada.

Nueva función RLS `empresa_actual()`, hermana de `tienda_actual()` ya
existente:

```sql
create or replace function empresa_actual() returns uuid as $$
  select empresa_id from public.perfiles where user_id = auth.uid()
$$ language sql stable security definer;
```

**Cambio mecánico transversal:** cada tabla de negocio en cada schema de
módulo (`clientes`, `originacion`, `cartera`, `contabilidad`, `catalogo`,
`agenda`) agrega columna `empresa_id uuid not null references public.empresas(id)`
y su política RLS pasa de `using (tienda_id = tienda_actual())` a
`using (empresa_id = empresa_actual() and tienda_id = tienda_actual())`
(o solo `empresa_id` para tablas que no tienen noción de tienda). Es
repetitivo pero mecánico — no toca lógica de dominio, solo la capa de
acceso. Regla 3 del proyecto (nunca FKs cruzadas ENTRE módulos) no se
viola: es la misma excepción ya vigente para `tienda_id` (FK de módulo
hacia `public`), aplicada un nivel más arriba.

**Por qué no schema-por-tenant:** SUMOTO ya usa el schema de Postgres como
el eje de los MÓDULOS (decisión 2026-07-11, no negociable sin discutirla).
Combinar schema-por-módulo con schema-por-tenant produce
`tenant_X_clientes`, `tenant_X_cartera`... por empresa — con cientos de
empresas-cliente esto es una explosión combinatoria de schemas que
Postgres no maneja bien (catálogo del sistema, migraciones que hay que
aplicar N veces, `pg_dump`/`pg_restore` cada vez más lentos). RLS con
`empresa_id` preserva el eje de módulo intacto y es el patrón que la
mayoría de SaaS multi-tenant sobre Postgres usa en producción.

## 4. Catálogo de productos/servicios genérico

Reemplaza `catalogo.motos`. Inspirado en cómo Medusa v2 modela productos
arbitrarios (investigado contra su documentación actual, no de memoria):
Medusa NO usa EAV puro — usa un `Product` base + `Option`/`OptionValue`
declarados POR PRODUCTO (no un vocabulario global fijo) + `metadata: json`
para lo no estructurado + extensión formal vía módulo enlazado para lo que
necesita lógica propia.

```sql
create table catalogo.productos (
  id                        uuid primary key default gen_random_uuid(),
  empresa_id                uuid not null references public.empresas(id),
  nombre                    text not null,
  tipo                      text not null check (tipo in ('bien', 'servicio')),
  imagen                    text,
  precio_contado_centavos   bigint not null check (precio_contado_centavos > 0),
  precio_credito_centavos   bigint not null check (precio_credito_centavos > 0),
  metadata                  jsonb not null default '{}',
  activo                    boolean not null default true,
  creado_en                 timestamptz not null default now()
);

create table catalogo.producto_opciones (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references catalogo.productos(id) on delete cascade,
  nombre       text not null  -- "Cilindraje", "Capacidad", "Duración"
);

create table catalogo.producto_opcion_valores (
  id         uuid primary key default gen_random_uuid(),
  opcion_id  uuid not null references catalogo.producto_opciones(id) on delete cascade,
  valor      text not null  -- "150cc", "128GB", "6 meses"
);
```

`cilindraje`/`potencia`/`frenos`/`rendimiento` (hoy columnas fijas de
`catalogo.motos`) pasan a ser opciones declaradas por el producto "moto",
no columnas del schema.

**Explícitamente fuera de alcance (YAGNI):** variantes con precio propio
por combinación de opciones (ej. una moto roja cuesta distinto a una
azul) — Medusa sí lo tiene, SUMOTO hoy no lo necesita (una moto = una
fila, sin variantes de precio). Se agrega como extensión clara si una
empresa lo pide, no se construye preventivamente.

## 5. Motor de políticas de crédito configurable

Hoy `ReglasDecision` (`packages/core/modules/originacion/domain/
credit-product.ts`) es una interfaz TS cerrada: `scoreMinimo`,
`cuotaMaximaPorcentajeIngreso`, `ltvMaximo`, `ingresoMinimoCentavos`,
`moraMaximaDias`. `decidirSolicitud` lee estos campos por nombre.

Se generaliza en dos piezas, con el mismo espíritu que el catálogo
(vocabulario curado por la plataforma + configuración por empresa, no EAV
libre):

```sql
create table originacion.criterios_evaluables (
  id             text primary key,  -- 'score', 'ingreso', 'ltv', 'mora_buro',
                                     -- 'geolocalizacion_valida', 'tipo_contrato',
                                     -- 'antiguedad_laboral_meses'
  nombre         text not null,
  tipo_dato      text not null check (tipo_dato in ('numero', 'booleano', 'texto')),
  operadores     text[] not null    -- comparadores válidos para este tipo: {'gte','lte'} etc.
);
```

`producto_credito.reglas_decision` (JSONB) pasa de objeto fijo a
**arreglo** de reglas:

```typescript
interface ReglaDecision {
  criterioId: string;     // referencia a originacion.criterios_evaluables
  operador: "gte" | "lte" | "eq";
  valorUmbral: number | boolean | string;
  obligatorio: boolean;   // true = bloquea si falla (como los 4 de verificacion.ts)
  peso?: number;          // solo si obligatorio = false (ponderado)
}
```

Este es el MISMO patrón que ya existe en `originacion/domain/
verificacion.ts` (4 obligatorios que bloquean + 5 ponderados, mínimo
70/100) — generalizado de 9 criterios fijos a N criterios curados por la
plataforma y elegidos por cada empresa. `decidirSolicitud` deja de tener
`if (solicitud.score < reglas.scoreMinimo)` hardcodeado: itera el arreglo,
evalúa cada regla contra los datos disponibles (solicitud/reporte de
riesgo/cliente), acumula bloqueos y puntaje ponderado.

**Extensión para lo no anticipado:** si una empresa necesita un criterio
que SUMOTO nunca curó (ej. "referencias familiares verificadas"), se
resuelve con un módulo nuevo enlazado (patrón `links`, ya usado en
`links.solicitud_credito`) que aporta un valor booleano/numérico
consumible por el motor genérico — nunca reabriendo el dominio de
`originacion` para ese caso puntual.

## 6. RBAC configurable dentro de los 5 roles fijos

Decisión explícita de Julián: los 5 roles de la plataforma
(`vendedor`/`manager`/`financiero`/`contable`/`ceo`) siguen siendo route
groups fijos del App Router — no se rediseña la navegación. Lo
configurable es QUÉ puede hacer cada rol dentro de una empresa dada.

```sql
create table seguridad.permisos_rol (
  empresa_id  uuid not null references public.empresas(id),
  rol         text not null,
  permiso     text not null,  -- 'politicas.editar', 'politicas.ver', 'cartera.exportar_csv'...
  primary key (empresa_id, rol, permiso)
);

create or replace function seguridad.tiene_permiso(p_permiso text) returns boolean as $$
  select exists (
    select 1 from seguridad.permisos_rol pr
    join public.perfiles p on p.rol = pr.rol and p.empresa_id = pr.empresa_id
    where p.user_id = auth.uid() and pr.permiso = p_permiso
  )
$$ language sql stable security definer;
```

`SeguridadService.tieneAcceso` (ya es la única fuente de verdad de
autorización desde el 2026-07-12) se extiende para consultar también esta
tabla — sin tocar `exigirRol`, `proxy.ts` ni el App Router. Nota de diseño:
esto es deliberadamente más simple que las tablas `roles`/`permissions`/
`role_permissions`/`user_roles` del repo de referencia — ahí los roles son
entidades dinámicas por tenant; aquí el rol sigue siendo el enum fijo de
5 valores, y solo el conjunto de permisos por rol varía por empresa. No se
necesita esa indirección extra.

## 7. Auditoría genérica (adoptado del repo de referencia)

Julián pidió explícitamente considerar traer del repo
`github.com/juliandavidnunesfranco/multitenant` ideas de auditoría. Del
código real de ese repo (`docs/schema/0000_initial_schema.sql`) se adopta
el patrón — no se copia literal, se adapta a convenciones de SUMOTO
(nombres en español, `empresa_id`, integrado con el event bus existente):

```sql
create schema if not exists auditoria;

create table auditoria.registros (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id),
  esquema     text not null,
  tabla       text not null,
  accion      text not null,  -- INSERT/UPDATE/DELETE
  usuario_id  uuid,
  datos_antes jsonb,
  datos_despues jsonb,
  creado_en   timestamptz not null default now()
);

create or replace function auditoria.registrar_cambio() returns trigger as $$
begin
  insert into auditoria.registros (empresa_id, esquema, tabla, accion, usuario_id, datos_antes, datos_despues)
  values (
    coalesce(new.empresa_id, old.empresa_id),
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, auth.uid(),
    case when TG_OP != 'INSERT' then to_jsonb(old) else null end,
    case when TG_OP != 'DELETE' then to_jsonb(new) else null end
  );
  return null;
end;
$$ language plpgsql security definer;
```

Se adjunta selectivamente a tablas sensibles (créditos, pagos, asientos,
reglas de decisión) vía una función helper `crear_trigger_auditoria(schema, tabla)`
— mismo espíritu que `create_audit_trigger()` del repo de referencia, sin
aplicarlo indiscriminadamente a TODAS las tablas (costo de escritura vs.
valor real por tabla).

**Relación con el backlog existente:** esto es un mecanismo distinto del
"outbox persistente del event bus" ya registrado en STATUS.md — auditoría
es rastro forense de cambios de fila (quién cambió qué), outbox es entrega
confiable de eventos de negocio para sagas. No se resuelven con la misma
tabla, aunque ambas nacen de la misma preocupación (algo se pierde/no
queda registrado hoy).

### Qué se descarta explícitamente del repo de referencia

- **Schema-por-tenant** (`create_tenant_schema()`/`clone_tenant_schema`) —
  choca con schema-por-módulo, ver sección 3.
- **Tabla `users` con `hashed_password`/`mfa_secret` propios** — duplica
  Supabase Auth de forma insegura. SUMOTO ya hace esto bien (Supabase Auth
  + `perfiles`); no se toca.
- **`@supabase/auth-helpers-nextjs`** — paquete deprecado, SUMOTO ya usa
  `@supabase/ssr` correctamente.
- **`docs/COMPLIANCE_ANALYSIS.md` del repo (21 CFR Part 11, ISO 13485)** —
  es para software de dispositivos médicos, no aplica a un producto de
  crédito colombiano. El marco de cumplimiento real a considerar en una
  fase posterior (fuera de esta spec) es Habeas Data (Ley 1581 de 2012 y
  Decreto 1377 de 2013), lineamientos SARLAFT si aplica, e ISO 27001 como
  buena práctica de seguridad de la información — no FDA/dispositivos
  médicos.

## 8. Migración de datos existentes

SUMOTO (motos) se convierte en **empresa #1** del sistema — dogfooding,
no un caso especial en el código. El seed:
1. Inserta la empresa "SUMOTO" en `public.empresas`.
2. Asigna `empresa_id` a las tiendas/perfiles existentes.
3. Migra `catalogo.motos` → `catalogo.productos` + `producto_opciones`/
   `producto_opcion_valores` (cilindraje/potencia/frenos/rendimiento pasan
   de columnas a opciones).
4. Traduce las `ReglasDecision` fijas actuales a filas de
   `originacion.criterios_evaluables` + arreglo de `ReglaDecision` en cada
   `producto_credito.reglas_decision` (mapeo 1:1: `scoreMinimo` → criterio
   `score`, etc.) — el guion de demo actual (cédula termina en 4-9 aprueba,
   etc.) sigue funcionando sin reescribirse.

## 9. Testing (no negociable)

El riesgo más grave de todo este pivote es una fuga de datos entre
empresas-cliente — el financiero de la empresa A viendo créditos de la
empresa B es un incidente de seguridad/reputacional real, no un bug
cualquiera. Se agrega una suite dedicada de **aislamiento entre tenants**
contra Supabase local real (no mocks, mismo espíritu que
`flow.e2e.test.ts`): crea 2+ empresas de prueba y verifica NEGATIVAMENTE
que ninguna consulta cruza el límite, en cada módulo con `empresa_id`.
Esta suite se escribe ANTES de dar por completa la migración de cualquier
módulo — no se agrega features nuevas sobre una base sin este test.

Adicional: tests unitarios del evaluador genérico de criterios (cada
combinación operador × tipo de dato) y de la traducción de
`ReglasDecision` fija → arreglo de reglas en la migración del seed.

## 10. Riesgos y decisiones pendientes (fuera de esta spec, registrar como backlog)

- Onboarding/aprovisionamiento de una empresa nueva (¿automático desde el
  sitio web? ¿manual por ahora?) y billing de la suscripción — piezas de
  negocio/infra independientes, su propia sesión de diseño.
- Navegación de catálogo/políticas para cientos de productos (sección 2
  de alcance) — se resuelve con paginación/búsqueda una vez el catálogo
  genérico exista; no requiere rediseño de arquitectura.
- Acciones del financiero para validar información del solicitante como
  flujo de UI — los campos ya están cubiertos como criterios evaluables;
  falta diseñar la pantalla/acción.
- Cliente Supabase por-request con JWT (ya backlogueado desde el
  2026-07-12) gana urgencia con multi-tenencia real: hoy el core usa
  `service_role` que bypassa RLS — la seguridad depende 100% de que la
  capa de aplicación filtre bien por `empresa_id`. Revisar antes de vender
  el producto a un cliente externo real (no solo demo).

## 11. Próximos pasos

Esta spec cubre la decisión arquitectónica fundacional. El siguiente paso
es un plan de implementación (skill `writing-plans`) que probablemente se
divida en incrementos: (1) `empresas` + RLS transversal sin romper el
demo actual de SUMOTO, (2) catálogo genérico, (3) motor de políticas
configurable, (4) RBAC configurable, (5) auditoría. Cada incremento debe
mantener 100% de los tests existentes en verde antes de avanzar al
siguiente.
