# Fase 2 de multi-tenencia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar el gap de `empresa_id`/`tienda_id` en los 13 tablas de los 5 módulos de negocio que faltan (`originacion`, `cartera`+`links`, `contabilidad`, `catalogo`, `agenda`), con triggers de cascada validados y RLS real, siguiendo el diseño aprobado.

**Architecture:** ver `docs/superpowers/specs/2026-07-26-fase2-multitenencia-design.md`
(diseño completo: clasificación de las 13 tablas en 4 grupos + caso especial
`asientos`, mecanismo de trigger explícito con validación, RLS, testing,
orden de migraciones). Este plan sigue el orden de esa spec:
`originacion` → `cartera`+`links` → `contabilidad` → `catalogo` → `agenda`.

**Tech Stack:** Supabase (Postgres, triggers `plpgsql`), TypeScript estricto,
vitest, Next.js 16 App Router.

## Global Constraints

- `empresaId: string` SIEMPRE como PRIMER parámetro obligatorio en TODO
  método de LECTURA de repositorio/servicio de los 5 módulos (mismo
  criterio que `reporteria` — nunca opcional, cruzar el límite de empresa
  nunca es legítimo).
- En las tablas Grupo 4 (`productos_credito`, `motos`, sin padre
  derivable), `empresaId` vive DENTRO del tipo/DTO de escritura (mismo
  patrón que `Cliente.empresaId`/`DatosCliente`), NO como parámetro
  separado del método `guardar`.
- Los triggers de cascada VALIDAN y RECHAZAN si el valor ya presente no
  coincide con el derivado del padre — nunca sobrescriben silenciosamente
  (decisión explícita de Julián, spec sección 3).
- Dinero SIEMPRE en centavos enteros, nunca float.
- TypeScript estricto, sin `any` sin justificar.
- Toda mutación de esquema es una migración versionada, nunca
  configuración manual en Studio.
- `psql` no está en PATH directo — usar
  `docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -c "..."`.
- Local Supabase ya corre — no reinstalar ni reiniciar salvo que
  `pnpm supabase status` muestre que está caído. NO correr
  `pnpm supabase db reset` (borraría datos de demo reales) — las
  migraciones deben incluir backfill explícito para las filas ya
  existentes en la DB local.
- Para verificar el typecheck real del core:
  `pnpm --filter @sumo/core typecheck`. Para el backoffice:
  `pnpm --filter backoffice exec tsc --noEmit` (más rápido que `build`
  para iterar; correr `build` una vez al final, Task 17).
- Para tests e2e, exportar las llaves:
  `export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)`
  `export SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/backoffice/.env.local | cut -d= -f2)`
- Cada tarea termina con `git commit` real (mismo criterio ya usado en
  los planes previos de esta serie — Julián lo confirmó para esta
  ejecución subagent-driven). Cada comando de un subagente debe empezar
  con `cd /home/juliandev/SUMOTO-PROJECT &&`, nunca asumir el directorio.
- Constante de la empresa SUMOTO del seed:
  `d0000000-0000-4000-8000-000000000001`.
- `asientos_recientes`/`reporteria` NO se tocan en este plan salvo lo que
  Task 9 requiere para que `contabilidad.asientos` tenga `empresa_id`
  (la spec de `reporteria` dejó ese gap documentado para cerrarse aquí).

---

## Módulo `originacion`

### Task 1: Migración SQL — `originacion` (4 tablas)

**Files:**
- Create: `supabase/migrations/20260727000000_originacion_empresa_id.sql`

**Interfaces:**
- Produces: columna `empresa_id` en `solicitudes` (NOT NULL), `empresa_id`+
  `tienda_id` en `decisiones`/`verificaciones` (NOT NULL), `empresa_id` en
  `productos_credito` (NOT NULL). Triggers de cascada en `solicitudes`,
  `decisiones`, `verificaciones`. RLS actualizada en las 4 tablas.

- [ ] **Step 1: Escribir la migración**

```sql
-- =============================================================================
-- originacion: empresa_id/tienda_id en solicitudes, decisiones, verificaciones,
-- productos_credito. Grupo 1 (solicitudes) y Grupo 2 (decisiones,
-- verificaciones) via trigger de cascada con validación; Grupo 4
-- (productos_credito) sin trigger, empresa_id explícito de la aplicación.
-- Ver docs/superpowers/specs/2026-07-26-fase2-multitenencia-design.md.
-- =============================================================================

-- --- solicitudes (Grupo 1: ya tiene tienda_id) ---

alter table originacion.solicitudes add column empresa_id uuid;

update originacion.solicitudes s
set empresa_id = t.empresa_id
from public.tiendas t
where t.id = s.tienda_id;

create or replace function originacion.derivar_tenencia_solicitud()
returns trigger as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from public.tiendas where id = new.tienda_id;
  if v_empresa_id is null then
    raise exception 'tienda_id % no existe en public.tiendas', new.tienda_id;
  end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de solicitud (%) no coincide con la tienda (%)',
      new.empresa_id, v_empresa_id;
  end if;
  new.empresa_id := v_empresa_id;
  return new;
end;
$$ language plpgsql;

create trigger solicitudes_derivar_tenencia
  before insert on originacion.solicitudes
  for each row execute function originacion.derivar_tenencia_solicitud();

alter table originacion.solicitudes alter column empresa_id set not null;

drop policy solicitudes_lectura on originacion.solicitudes;
create policy solicitudes_lectura on originacion.solicitudes
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );

drop policy solicitudes_actualizacion on originacion.solicitudes;
create policy solicitudes_actualizacion on originacion.solicitudes
  for update to authenticated
  using (
    empresa_id = empresa_actual() and
    rol_actual() = any (array['vendedor'::rol_usuario, 'manager'::rol_usuario]) and
    tienda_id = tienda_actual()
  );

drop policy solicitudes_registro on originacion.solicitudes;
create policy solicitudes_registro on originacion.solicitudes
  for insert to authenticated
  with check (
    rol_actual() = any (array['vendedor'::rol_usuario, 'manager'::rol_usuario]) and
    tienda_id = tienda_actual()
  );
-- nota: solicitudes_registro NO valida empresa_id porque el trigger lo
-- deriva DESPUÉS del with check en el mismo INSERT — validar tienda_actual()
-- ya acota correctamente (tienda_actual() solo puede ser de la empresa del
-- usuario), no hace falta duplicar la condición.

-- --- decisiones (Grupo 2: hija de solicitudes) ---

alter table originacion.decisiones add column empresa_id uuid;
alter table originacion.decisiones add column tienda_id uuid;

update originacion.decisiones d
set empresa_id = s.empresa_id, tienda_id = s.tienda_id
from originacion.solicitudes s
where s.id = d.solicitud_id;

create or replace function originacion.derivar_tenencia_decision()
returns trigger as $$
declare
  v_empresa_id uuid;
  v_tienda_id uuid;
begin
  select empresa_id, tienda_id into v_empresa_id, v_tienda_id
  from originacion.solicitudes where id = new.solicitud_id;

  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de decisión (%) no coincide con la solicitud padre (%)',
      new.empresa_id, v_empresa_id;
  end if;
  if new.tienda_id is not null and new.tienda_id <> v_tienda_id then
    raise exception 'tienda_id de decisión (%) no coincide con la solicitud padre (%)',
      new.tienda_id, v_tienda_id;
  end if;

  new.empresa_id := v_empresa_id;
  new.tienda_id := v_tienda_id;
  return new;
end;
$$ language plpgsql;

create trigger decisiones_derivar_tenencia
  before insert on originacion.decisiones
  for each row execute function originacion.derivar_tenencia_decision();

alter table originacion.decisiones alter column empresa_id set not null;
alter table originacion.decisiones alter column tienda_id set not null;

drop policy decisiones_lectura on originacion.decisiones;
create policy decisiones_lectura on originacion.decisiones
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );
-- decisiones_registro se mantiene igual (INSERT lo hace el motor de
-- decisión vía service_role, sin política de rol específica hoy) — si
-- existiera, agregar empresa_id = empresa_actual() análogamente.

-- --- verificaciones (Grupo 2: hija de solicitudes) ---

alter table originacion.verificaciones add column empresa_id uuid;
alter table originacion.verificaciones add column tienda_id uuid;

update originacion.verificaciones v
set empresa_id = s.empresa_id, tienda_id = s.tienda_id
from originacion.solicitudes s
where s.id = v.solicitud_id;

create or replace function originacion.derivar_tenencia_verificacion()
returns trigger as $$
declare
  v_empresa_id uuid;
  v_tienda_id uuid;
begin
  select empresa_id, tienda_id into v_empresa_id, v_tienda_id
  from originacion.solicitudes where id = new.solicitud_id;

  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de verificación (%) no coincide con la solicitud padre (%)',
      new.empresa_id, v_empresa_id;
  end if;
  if new.tienda_id is not null and new.tienda_id <> v_tienda_id then
    raise exception 'tienda_id de verificación (%) no coincide con la solicitud padre (%)',
      new.tienda_id, v_tienda_id;
  end if;

  new.empresa_id := v_empresa_id;
  new.tienda_id := v_tienda_id;
  return new;
end;
$$ language plpgsql;

create trigger verificaciones_derivar_tenencia
  before insert on originacion.verificaciones
  for each row execute function originacion.derivar_tenencia_verificacion();

alter table originacion.verificaciones alter column empresa_id set not null;
alter table originacion.verificaciones alter column tienda_id set not null;

drop policy verificaciones_lectura on originacion.verificaciones;
create policy verificaciones_lectura on originacion.verificaciones
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );

-- --- productos_credito (Grupo 4: raíz sin padre, sin trigger) ---

alter table originacion.productos_credito add column empresa_id uuid;

update originacion.productos_credito
set empresa_id = 'd0000000-0000-4000-8000-000000000001'
where empresa_id is null;

alter table originacion.productos_credito alter column empresa_id set not null;

drop policy productos_lectura on originacion.productos_credito;
create policy productos_lectura on originacion.productos_credito
  for select to authenticated
  using (empresa_id = empresa_actual());

drop policy productos_actualizacion on originacion.productos_credito;
create policy productos_actualizacion on originacion.productos_credito
  for update to authenticated
  using (rol_actual() = 'financiero'::rol_usuario and empresa_id = empresa_actual());

drop policy productos_registro on originacion.productos_credito;
create policy productos_registro on originacion.productos_credito
  for insert to authenticated
  with check (rol_actual() = 'financiero'::rol_usuario and empresa_id = empresa_actual());
```

- [ ] **Step 2: Aplicar la migración**

Run: `pnpm supabase migration up` (aplica solo la migración nueva, sin
reset — preserva los datos de demo).
Expected: sin errores.

- [ ] **Step 3: Verificar backfill y triggers**

```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select count(*) from originacion.solicitudes where empresa_id is null;"
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select count(*) from originacion.decisiones where empresa_id is null or tienda_id is null;"
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select count(*) from originacion.verificaciones where empresa_id is null or tienda_id is null;"
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select count(*) from originacion.productos_credito where empresa_id is null;"
```
Expected: las 4 consultas devuelven `0`.

Control negativo del trigger (probar UNA vez, revertir):
```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "insert into originacion.solicitudes (cliente_id, producto_id, tienda_id, valor_moto_centavos, cuota_inicial_centavos, plazo_meses, ingresos_declarados_centavos, moto_id, creado_por, empresa_id) select cliente_id, producto_id, tienda_id, valor_moto_centavos, cuota_inicial_centavos, plazo_meses, ingresos_declarados_centavos, moto_id, creado_por, gen_random_uuid() from originacion.solicitudes limit 1;"
```
Expected: falla con `empresa_id de solicitud (...) no coincide con la tienda (...)`. Esto confirma que el trigger VALIDA (no solo deriva). No hace falta limpiar nada — el insert falló, no se insertó ninguna fila.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260727000000_originacion_empresa_id.sql
git commit -m "feat(originacion): empresa_id/tienda_id en solicitudes, decisiones, verificaciones, productos_credito"
```

---

### Task 2: Dominio + contrato + repositorio + servicio — `originacion`

**Files:**
- Modify: `packages/core/modules/originacion/domain/credit-product.ts`
- Modify: `packages/core/modules/originacion/domain/repositories.ts`
- Modify: `packages/core/modules/originacion/infrastructure/supabase-repositories.ts`
- Modify: `packages/core/modules/originacion/application/manage-credit-product.ts`
- Modify: `packages/core/modules/originacion/service.ts`

**Interfaces:**
- Consumes: columnas de la Task 1.
- Produces: `DatosProducto`/`ProductoCredito` con `empresaId: string`;
  `RepositorioProductos.buscarPorId(empresaId, id)`,
  `.listarActivos(empresaId)`; `RepositorioSolicitudes.buscarPorId(empresaId,
  solicitudId)`, `.buscarDecision(empresaId, solicitudId)`,
  `.reporteDeRiesgo(empresaId, solicitudId)`;
  `RepositorioVerificaciones.marcasDe(empresaId, solicitudId)`;
  `OriginacionService.listarProductosActivos(empresaId)`,
  `.buscarProducto(empresaId, id)`, `.actualizarReglas(empresaId,
  productoId, reglasNuevas)`, `.paraDesembolso(empresaId, solicitudId)`,
  `.verificacionDe(empresaId, solicitudId)`,
  `.reporteDeRiesgoArchivado(empresaId, solicitudId)`,
  `.solicitudEvaluada(empresaId, solicitudId)`. Consumido por Task 3
  (call sites) y por `cartera` (Task 7, vía `FuenteSolicitudesAprobadas`).

- [ ] **Step 1: `domain/credit-product.ts`**

Agregar `empresaId: string` a `ProductoCredito` y `DatosProducto`:

```typescript
export interface ProductoCredito {
  id: string;
  empresaId: string;
  nombre: string;
  tasaEA: number;
  plazoMinMeses: number;
  plazoMaxMeses: number;
  reglasDecision: ReglasDecision;
  activo: boolean;
}

export interface DatosProducto {
  empresaId: string;
  nombre: string;
  tasaEA: number;
  plazoMinMeses: number;
  plazoMaxMeses: number;
  reglasDecision: ReglasDecision;
}
```

En `validarProducto`, agregar la validación de `empresaId` junto a las
demás (mismo estilo — acumula violaciones, no corta):

```typescript
if (datos.empresaId.trim() === "") {
  violaciones.push("empresaId es obligatorio");
}
```

`crearProducto` y `actualizarReglas` no cambian de lógica — `crearProducto`
ya hace `{ ...datos, activo: true }` (línea 97), que arrastra `empresaId`
automáticamente porque ya está en `datos`.

- [ ] **Step 2: `domain/repositories.ts`**

```typescript
export interface RepositorioProductos {
  buscarPorId(empresaId: string, id: string): Promise<ProductoCredito | null>;
  listarActivos(empresaId: string): Promise<ProductoCredito[]>;
  guardar(producto: Omit<ProductoCredito, "id">): Promise<ProductoCredito>;
  actualizarReglas(producto: ProductoCredito): Promise<ProductoCredito>;
}

export interface RepositorioSolicitudes {
  guardar(solicitud: Solicitud): Promise<Solicitud>;
  guardarDecision(
    solicitudId: string,
    decision: Decision,
    reporteRiesgo: unknown,
  ): Promise<void>;
  actualizarEstado(solicitudId: string, estado: Solicitud["estado"]): Promise<void>;
  eliminar(solicitudId: string): Promise<void>;
  eliminarDecisiones(solicitudId: string): Promise<void>;
  buscarPorId(empresaId: string, solicitudId: string): Promise<Solicitud | null>;
  buscarDecision(empresaId: string, solicitudId: string): Promise<Decision | null>;
  reporteDeRiesgo(empresaId: string, solicitudId: string): Promise<unknown | null>;
}

export interface RepositorioVerificaciones {
  marcar(
    solicitudId: string,
    itemCodigo: string,
    marcado: boolean,
    marcadoPor: string,
  ): Promise<void>;
  marcasDe(empresaId: string, solicitudId: string): Promise<MarcaVerificacion[]>;
}
```
(`guardar`/`actualizarReglas`/`guardarDecision`/`actualizarEstado`/
`eliminar`/`eliminarDecisiones`/`marcar` NO cambian — son escritura sobre
tablas Grupo 1/2, el trigger deriva; `actualizarReglas` ya recibe el
`ProductoCredito` completo con `empresaId` embebido, así que la
implementación puede usarlo en el `WHERE` sin cambiar la firma).

- [ ] **Step 3: `infrastructure/supabase-repositories.ts`**

`RepositorioProductosSupabase`:

```typescript
async buscarPorId(empresaId: string, id: string): Promise<ProductoCredito | null> {
  const { data, error } = await this.supabase
    .schema("originacion")
    .from("productos_credito")
    .select()
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle<FilaProducto>();
  if (error) throw new Error(`[originacion] error buscando producto: ${error.message}`);
  return data ? aProducto(data) : null;
}

async listarActivos(empresaId: string): Promise<ProductoCredito[]> {
  const { data, error } = await this.supabase
    .schema("originacion")
    .from("productos_credito")
    .select()
    .eq("activo", true)
    .eq("empresa_id", empresaId)
    .order("creado_en")
    .returns<FilaProducto[]>();
  if (error) throw new Error(`[originacion] error listando productos: ${error.message}`);
  return (data ?? []).map(aProducto);
}

async actualizarReglas(producto: ProductoCredito): Promise<ProductoCredito> {
  const { data, error } = await this.supabase
    .schema("originacion")
    .from("productos_credito")
    .update({ reglas_decision: producto.reglasDecision })
    .eq("id", producto.id)
    .eq("empresa_id", producto.empresaId)
    .select()
    .single<FilaProducto>();
  if (error) throw new Error(`[originacion] error actualizando reglas: ${error.message}`);
  return aProducto(data);
}
```
(`guardar` no cambia su cuerpo de query — solo el mapper `aFilaProductoNueva`,
que ahora debe incluir `empresa_id: producto.empresaId` en el objeto
insertado; y `aProducto`/`FilaProducto` deben incluir `empresa_id` →
`empresaId` en la traducción de ida y vuelta. Verificar el archivo mapper
del módulo — probablemente `originacion/infrastructure/product-mapper.ts`
o incluido en el mismo archivo de repositorios — y agregar el campo en
ambos sentidos siguiendo el patrón exacto que ya usa `client-mapper.ts`
para `empresa_id`.)

`RepositorioSolicitudesSupabase`:

```typescript
async buscarPorId(empresaId: string, solicitudId: string): Promise<Solicitud | null> {
  const { data, error } = await this.supabase
    .schema("originacion")
    .from("solicitudes")
    .select()
    .eq("id", solicitudId)
    .eq("empresa_id", empresaId)
    .maybeSingle<FilaSolicitud>();
  if (error) throw new Error(`[originacion] error buscando solicitud: ${error.message}`);
  return data ? aSolicitud(data) : null;
}

async buscarDecision(empresaId: string, solicitudId: string): Promise<Decision | null> {
  const { data, error } = await this.supabase
    .schema("originacion")
    .from("decisiones")
    .select("resultado, razones, score, cuota_estimada_centavos")
    .eq("solicitud_id", solicitudId)
    .eq("empresa_id", empresaId)
    .order("evaluado_en", { ascending: false })
    .limit(1)
    .maybeSingle<{
      resultado: string;
      razones: string[];
      score: number | null;
      cuota_estimada_centavos: number | null;
    }>();
  if (error) throw new Error(`[originacion] error buscando decisión: ${error.message}`);
  if (!data) return null;
  return {
    resultado: data.resultado as Decision["resultado"],
    razones: data.razones,
    score: data.score ?? undefined,
    cuotaEstimadaCentavos: data.cuota_estimada_centavos ?? undefined,
  };
}

async reporteDeRiesgo(empresaId: string, solicitudId: string): Promise<unknown | null> {
  const { data, error } = await this.supabase
    .schema("originacion")
    .from("decisiones")
    .select("reporte_riesgo")
    .eq("solicitud_id", solicitudId)
    .eq("empresa_id", empresaId)
    .order("evaluado_en", { ascending: false })
    .limit(1)
    .maybeSingle<{ reporte_riesgo: unknown }>();
  if (error) throw new Error(`[originacion] error leyendo reporte de riesgo: ${error.message}`);
  return data?.reporte_riesgo ?? null;
}
```
(Ajustar los nombres exactos de columnas seleccionadas contra el archivo
real al implementar — el shape de `buscarDecision`/`reporteDeRiesgo` ya
existe hoy sin el filtro de empresa, solo se agrega `.eq("empresa_id",
empresaId)` a la query existente, sin tocar el resto de columnas
seleccionadas ni el mapeo de retorno.)

`RepositorioVerificacionesSupabase`:

```typescript
async marcasDe(empresaId: string, solicitudId: string): Promise<MarcaVerificacion[]> {
  const { data, error } = await this.supabase
    .schema("originacion")
    .from("verificaciones")
    .select()
    .eq("solicitud_id", solicitudId)
    .eq("empresa_id", empresaId)
    .returns<FilaVerificacion[]>();
  if (error) throw new Error(`[originacion] error leyendo verificaciones: ${error.message}`);
  return (data ?? []).map(aMarcaVerificacion);
}
```
(Mismo criterio: se agrega `.eq("empresa_id", empresaId)` a la query
`marcasDe` existente, sin tocar el resto.)

- [ ] **Step 4: `application/manage-credit-product.ts`**

```typescript
export class ActualizarReglasDecision {
  constructor(private readonly productos: RepositorioProductos) {}

  async ejecutar(
    empresaId: string,
    productoId: string,
    reglasNuevas: ReglasDecision,
  ): Promise<Resultado<ProductoCredito, string[]>> {
    const producto = await this.productos.buscarPorId(empresaId, productoId);
    if (!producto) {
      return { ok: false, error: [`producto no encontrado: ${productoId}`] };
    }
    const actualizacion = actualizarReglas(producto, reglasNuevas);
    if (!actualizacion.ok) return actualizacion;
    const guardado = await this.productos.actualizarReglas(actualizacion.valor);
    return { ok: true, valor: guardado };
  }
}
```
(`CrearProductoCredito.ejecutar(datos: DatosProducto)` no cambia de firma
— `empresaId` ya viaja dentro de `datos`.)

- [ ] **Step 5: `service.ts`**

```typescript
listarProductosActivos(empresaId: string) {
  return this.productos.listarActivos(empresaId);
}

buscarProducto(empresaId: string, id: string) {
  return this.productos.buscarPorId(empresaId, id);
}

crearProducto(datos: DatosProducto) {
  return this.casoCrearProducto.ejecutar(datos);
}

actualizarReglas(empresaId: string, productoId: string, reglasNuevas: ReglasDecision) {
  return this.casoActualizarReglas.ejecutar(empresaId, productoId, reglasNuevas);
}

async paraDesembolso(empresaId: string, solicitudId: string): Promise<SolicitudParaDesembolso | null> {
  // el cuerpo interno ya llama this.solicitudEvaluada(...), this.productos.buscarPorId(...),
  // this.estadoVerificacion(...) — cada una de esas 3 llamadas gana empresaId como
  // primer argumento (mismo empresaId recibido aquí, no uno nuevo).
}

async verificacionDe(empresaId: string, solicitudId: string) {
  // internamente: this.verificaciones.marcasDe(empresaId, solicitudId)
}

reporteDeRiesgoArchivado(empresaId: string, solicitudId: string) {
  return this.solicitudes.reporteDeRiesgo(empresaId, solicitudId);
}

async solicitudEvaluada(empresaId: string, solicitudId: string) {
  return Promise.all([
    this.solicitudes.buscarPorId(empresaId, solicitudId),
    this.solicitudes.buscarDecision(empresaId, solicitudId),
  ]);
}

private async estadoVerificacion(empresaId: string, solicitudId: string): Promise<EstadoVerificacion> {
  // internamente: this.verificaciones.marcasDe(empresaId, solicitudId)
}
```
(`evaluarSolicitud`, `marcarVerificacion`, `consultarRiesgo`,
`subirDocumento`, `listarDocumentos`, `descargarDocumento`,
`simularDecision` NO cambian — ya sea porque son escritura vía trigger,
Storage puro, o no persisten nada.)

- [ ] **Step 6: Typecheck del core**

Run: `pnpm --filter @sumo/core typecheck`
Expected: errores en `service.test.ts`, `evaluate-application.test.ts`
(fixtures desactualizados) — se resuelven en Task 4. Confirmar que NO hay
errores en código de producción (`domain/`, `infrastructure/`,
`application/`, `service.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/core/modules/originacion/domain/credit-product.ts \
  packages/core/modules/originacion/domain/repositories.ts \
  packages/core/modules/originacion/infrastructure/supabase-repositories.ts \
  packages/core/modules/originacion/application/manage-credit-product.ts \
  packages/core/modules/originacion/service.ts
git commit -m "feat(originacion): empresaId obligatorio en repositorios y OriginacionService"
```

---

### Task 3: Call sites del backoffice — `originacion`

**Files:**
- Modify: `apps/backoffice/app/api/productos/route.ts`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/buro/route.ts`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/identidad/route.ts`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/page.tsx`
- Modify: `apps/backoffice/app/(financiero)/layout.tsx`
- Modify: `apps/backoffice/app/(financiero)/politicas/actions.ts`
- Modify: `apps/backoffice/app/(financiero)/politicas/page.tsx`
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/nueva/actions.ts`
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/nueva/page.tsx`

**Interfaces:**
- Consumes: los métodos de `OriginacionService` de la Task 2.

- [ ] **Step 1: `app/api/productos/route.ts`**

```typescript
// antes
const productos = await originacionService().listarProductosActivos();
// después (sesion ya viene de exigirRol arriba en el mismo archivo)
const productos = await originacionService().listarProductosActivos(sesion.empresaId);
```

- [ ] **Step 2: `(financiero)/desembolsos/[solicitudId]/buro/route.ts`**

```typescript
// antes
const reporte = await originacionService().reporteDeRiesgoArchivado(solicitudId);
const evaluada = await originacionService().solicitudEvaluada(solicitudId);
// después (sesion ya viene de exigirRol arriba)
const reporte = await originacionService().reporteDeRiesgoArchivado(sesion.empresaId, solicitudId);
const evaluada = await originacionService().solicitudEvaluada(sesion.empresaId, solicitudId);
```

- [ ] **Step 3: `(financiero)/desembolsos/[solicitudId]/identidad/route.ts`**

```typescript
// antes
const evaluada = await originacionService().solicitudEvaluada(solicitudId);
// después (sesion.empresaId ya se usa en la línea de clientesService justo arriba)
const evaluada = await originacionService().solicitudEvaluada(sesion.empresaId, solicitudId);
```

- [ ] **Step 4: `(financiero)/desembolsos/[solicitudId]/page.tsx`**

```typescript
// antes
const evaluada = await originacionService().solicitudEvaluada(solicitudId);
const verificacion = await originacionService().verificacionDe(solicitudId);
// (listarDocumentos no cambia, es Storage)
const producto = await originacionService().buscarProducto(par.solicitud.productoId);
// después (sesion.empresaId ya se usa para clientesService en este archivo)
const evaluada = await originacionService().solicitudEvaluada(sesion.empresaId, solicitudId);
const verificacion = await originacionService().verificacionDe(sesion.empresaId, solicitudId);
const producto = await originacionService().buscarProducto(sesion.empresaId, par.solicitud.productoId);
```

- [ ] **Step 5: `(financiero)/layout.tsx`**

```typescript
// antes
const productos = await originacionService().listarProductosActivos();
// después (sesion ya viene de exigirRol arriba)
const productos = await originacionService().listarProductosActivos(sesion.empresaId);
```

- [ ] **Step 6: `(financiero)/politicas/actions.ts`**

```typescript
// crearProducto: antes
async function sesionDeFinanciero() {
  const sesion = await exigirRol(["financiero"]);
  if (sesion instanceof Response) redirect("/login?denegado=1");
  return sesion;
}

export async function crearProducto(formData: FormData): Promise<void> {
  await sesionDeFinanciero();
  // ...forma...
  const resultado = await originacionService().crearProducto(forma.data);
  ...
}

// después
export async function crearProducto(formData: FormData): Promise<void> {
  const sesion = await sesionDeFinanciero();
  // ...forma... (sin cambios)
  const resultado = await originacionService().crearProducto({
    ...forma.data,
    empresaId: sesion.empresaId,
  });
  ...
}
```

```typescript
// actualizarReglas: antes
export async function actualizarReglas(formData: FormData): Promise<void> {
  await sesionDeFinanciero();
  // ...forma...
  const resultado = await originacionService().actualizarReglas(
    forma.data.productoId,
    forma.data.reglasDecision,
  );
  ...
}

// después
export async function actualizarReglas(formData: FormData): Promise<void> {
  const sesion = await sesionDeFinanciero();
  // ...forma... (sin cambios)
  const resultado = await originacionService().actualizarReglas(
    sesion.empresaId,
    forma.data.productoId,
    forma.data.reglasDecision,
  );
  ...
}
```
(`simularDecision` no cambia — no persiste ni consulta `productos_credito`
por id, evalúa con los valores crudos del formulario de simulación.)

- [ ] **Step 7: `(financiero)/politicas/page.tsx` — agregar sesión**

Este archivo hoy NO llama `obtenerSesion()`/`exigirRol()` (depende del
layout padre) — mismo patrón que se agregó a `cartera/page.tsx` en el
plan de `reporteria` (2026-07-26).

```typescript
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
```

```typescript
// antes
const productos = await originacionService().listarProductosActivos();
const seleccionado = params.productoId
  ? await originacionService().buscarProducto(params.productoId)
  : null;

// después
const sesion = await obtenerSesion();
if (!sesion) notFound();

const productos = await originacionService().listarProductosActivos(sesion.empresaId);
const seleccionado = params.productoId
  ? await originacionService().buscarProducto(sesion.empresaId, params.productoId)
  : null;
```
(Verificar la posición exacta de estas dos llamadas en el archivo real
antes de aplicar — el plan de sliders del 2026-07-24/25 ya modificó este
archivo, así que los números de línea de la sesión de reporteria ya no
aplican; localizar por el texto `listarProductosActivos()`/
`buscarProducto(` literal.)

- [ ] **Step 8: `(vendedor)/solicitudes/nueva/actions.ts`**

```typescript
// antes
const evaluada = await originacionService().solicitudEvaluada(solicitudId);
// después (sesion ya está en scope desde sesionDeVendedor())
const evaluada = await originacionService().solicitudEvaluada(sesion.empresaId, solicitudId);
```

- [ ] **Step 9: `(vendedor)/solicitudes/nueva/page.tsx`**

```typescript
// antes
const productos = await originacionService().listarProductosActivos();
const evaluada = params.solicitudId
  ? await originacionService().solicitudEvaluada(params.solicitudId)
  : null;
const producto = await originacionService().buscarProducto(evaluada.solicitud.productoId);
// consultarRiesgo no cambia

// después (sesion.empresaId ya se usa para clientesService en este archivo)
const productos = await originacionService().listarProductosActivos(sesion.empresaId);
const evaluada = params.solicitudId
  ? await originacionService().solicitudEvaluada(sesion.empresaId, params.solicitudId)
  : null;
const producto = await originacionService().buscarProducto(sesion.empresaId, evaluada.solicitud.productoId);
```

- [ ] **Step 10: Typecheck del backoffice**

Run: `pnpm --filter backoffice exec tsc --noEmit`
Expected: cero errores relacionados a `originacionService()` (pueden
seguir apareciendo errores de `cartera`/`catalogo`/`agenda` si esas tareas
no se han hecho todavía — no es este el caso porque este plan las hace en
orden, así que en este punto debería quedar limpio).

- [ ] **Step 11: Commit**

```bash
git add apps/backoffice/app/api/productos/route.ts \
  "apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/buro/route.ts" \
  "apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/identidad/route.ts" \
  "apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/page.tsx" \
  "apps/backoffice/app/(financiero)/layout.tsx" \
  "apps/backoffice/app/(financiero)/politicas/actions.ts" \
  "apps/backoffice/app/(financiero)/politicas/page.tsx" \
  "apps/backoffice/app/(vendedor)/solicitudes/nueva/actions.ts" \
  "apps/backoffice/app/(vendedor)/solicitudes/nueva/page.tsx"
git commit -m "feat(backoffice): empresaId en los 9 call sites de originacion"
```

---

### Task 4: Tests — `originacion`

**Files:**
- Modify: `packages/core/modules/originacion/service.test.ts`
- Modify: `packages/core/modules/originacion/application/evaluate-application.test.ts`
- Modify: `packages/core/modules/originacion/domain/credit-product.test.ts`
- Modify: `packages/core/flow.e2e.test.ts`
- Create: `packages/core/aislamiento-originacion.e2e.test.ts`

**Interfaces:**
- Consumes: firmas de la Task 2.

- [ ] **Step 1: `service.test.ts`**

`armarServicio` no necesita cambios (los stubs `async () => ...` ignoran
argumentos en runtime). Las 3 llamadas a `svc.paraDesembolso("sol-1")`
(líneas 93, 119, 129) pasan a `svc.paraDesembolso("empresa-1", "sol-1")`
— agregar una constante `EMPRESA_ID = "empresa-1"` al inicio del archivo,
junto a `PRODUCTO`/`SOLICITUD`/`DECISION`.

- [ ] **Step 2: `application/evaluate-application.test.ts`**

`class ProductosFijos implements RepositorioProductos` gana los 2
parámetros nuevos en sus métodos:
```typescript
class ProductosFijos implements RepositorioProductos {
  async buscarPorId(_empresaId: string, id: string) { return id === PRODUCTO.id ? PRODUCTO : null; }
  async listarActivos(_empresaId: string) { return [PRODUCTO]; }
  async guardar(producto: Omit<ProductoCredito, "id">) { return { ...producto, id: "prod-nuevo" }; }
  async actualizarReglas(producto: ProductoCredito) { return producto; }
}
```
`PRODUCTO` (fixture, probablemente cerca de la clase) gana `empresaId:
"empresa-1"`.

`class SolicitudesEnMemoria implements RepositorioSolicitudes` gana el
parámetro en sus 3 métodos de lectura (`buscarPorId`, `buscarDecision`,
`reporteDeRiesgo`) — mismo patrón, primer parámetro `_empresaId: string`
ignorado en el cuerpo si el fixture no lo necesita para su lógica actual.

- [ ] **Step 3: `domain/credit-product.test.ts`**

`DATOS_OK: DatosProducto` (línea 19-25) gana `empresaId: "empresa-1"`.
`PRODUCTO: ProductoCredito` (línea 88, `{ id: "prod-1", ...DATOS_OK, activo: true }`)
hereda el campo automáticamente por el spread — no necesita edición
propia. Ningún caso `it(...)` necesita cambio de aserciones (el campo no
participa en ninguna validación probada).

- [ ] **Step 4: `flow.e2e.test.ts`**

```typescript
// antes (línea ~47)
const productos = await originacion.listarProductosActivos();
// después
const productos = await originacion.listarProductosActivos(EMPRESA);
```
(`EMPRESA` ya es una constante en este archivo, línea 22 —
`"d0000000-0000-4000-8000-000000000001"`.)

- [ ] **Step 5: Correr la suite unitaria del core**

Run: `pnpm --filter @sumo/core test`
Expected: 138/138 passing (sin nuevos tests todavía, solo fixtures
actualizados).

- [ ] **Step 6: Suite de aislamiento — `aislamiento-originacion.e2e.test.ts`**

Mismo patrón que `aislamiento-tenant.e2e.test.ts` (empresa rival + fixture
vía `service_role`), pero cubriendo TAMBIÉN el trigger de cascada (algo
que `aislamiento-tenant.e2e.test.ts` de `clientes`, fase 1, no necesitaba
porque `clientes` no tiene tablas hijas con trigger):

```typescript
// Aislamiento entre tenants para originacion — repositorio + RLS +
// validación de trigger de cascada (solicitudes → decisiones/verificaciones).
// Se corre manualmente:
// npx vitest run aislamiento-originacion.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { OriginacionService } from "./modules/originacion/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const EMPRESA_SUMOTO = "d0000000-0000-4000-8000-000000000001";
const SUFIJO = Date.now().toString(36);

describe("aislamiento entre empresas — originacion", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let solicitudRival: string;

  beforeAll(async () => {
    arrancarNucleo({ supabase });

    const { data: empresa, error: errEmpresa } = await supabase
      .from("empresas")
      .insert({ nombre: "Rival Originacion S.A.S.", slug: `rival-originacion-${SUFIJO}` })
      .select("id")
      .single();
    if (errEmpresa) throw errEmpresa;
    empresaRival = empresa.id;

    const { data: tienda, error: errTienda } = await supabase
      .from("tiendas")
      .insert({ nombre: "Rival Originacion Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    if (errTienda) throw errTienda;
    tiendaRival = tienda.id;

    const { data: cliente, error: errCliente } = await supabase
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: `22${Date.now().toString().slice(-8)}`,
        nombres: "Rita",
        apellidos: "Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();
    if (errCliente) throw errCliente;

    const { data: motoCualquiera, error: errMoto } = await supabase
      .schema("catalogo")
      .from("motos")
      .select("id")
      .limit(1)
      .single();
    if (errMoto) throw errMoto;

    const { data: solicitud, error: errSolicitud } = await supabase
      .schema("originacion")
      .from("solicitudes")
      .insert({
        cliente_id: cliente.id,
        producto_id: "bbbbbbbb-0000-4000-8000-000000000001",
        moto_id: motoCualquiera.id,
        tienda_id: tiendaRival,
        valor_moto_centavos: 800_000_000,
        cuota_inicial_centavos: 200_000_000,
        plazo_meses: 24,
        ingresos_declarados_centavos: 300_000_000,
        estado: "evaluada",
        creado_por: "a0000000-0000-4000-8000-000000000001",
      })
      .select("id")
      .single();
    if (errSolicitud) throw errSolicitud;
    solicitudRival = solicitud.id;

    const { error: errDecision } = await supabase
      .schema("originacion")
      .from("decisiones")
      .insert({
        solicitud_id: solicitudRival,
        resultado: "APROBADO",
        razones: ["cumple políticas"],
        score: 720,
        cuota_estimada_centavos: 30_000_000,
      });
    if (errDecision) throw errDecision;
  });

  it("SUMOTO nunca ve la solicitud de la empresa rival", async () => {
    const originacion = resolver<OriginacionService>(TOKENS.originacionService);
    const solicitud = await originacion.solicitudEvaluada(EMPRESA_SUMOTO, solicitudRival);
    expect(solicitud[0]).toBeNull();
  });

  it("la empresa rival SÍ ve su propia solicitud y decisión", async () => {
    const originacion = resolver<OriginacionService>(TOKENS.originacionService);
    const [sol, decision] = await originacion.solicitudEvaluada(empresaRival, solicitudRival);
    expect(sol).not.toBeNull();
    expect(decision?.resultado).toBe("APROBADO");
  });

  it("el trigger de decisiones RECHAZA un empresa_id que no coincide con la solicitud padre", async () => {
    const { error } = await supabase
      .schema("originacion")
      .from("decisiones")
      .insert({
        solicitud_id: solicitudRival,
        resultado: "NEGADO",
        razones: ["prueba de control negativo"],
        empresa_id: EMPRESA_SUMOTO, // deliberadamente distinto al de la solicitud (empresaRival)
      });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/no coincide/);
  });
});
```

- [ ] **Step 7: Correr y confirmar**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core exec vitest run aislamiento-originacion.e2e.test.ts --config vitest.e2e.config.ts
```
Expected: 3/3 PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/modules/originacion/service.test.ts \
  packages/core/modules/originacion/application/evaluate-application.test.ts \
  packages/core/modules/originacion/domain/credit-product.test.ts \
  packages/core/flow.e2e.test.ts \
  packages/core/aislamiento-originacion.e2e.test.ts
git commit -m "test(originacion): fixtures actualizados + suite de aislamiento con validación de trigger"
```

---

## Módulo `cartera` + `links`

### Task 5: Migración SQL — `cartera` + `links` (5 tablas)

**Files:**
- Create: `supabase/migrations/20260728000000_cartera_empresa_id.sql`

**Interfaces:**
- Produces: `empresa_id` en `creditos` (Grupo 1, vía `tienda_id`);
  `empresa_id`+`tienda_id` en `cuotas`/`pagos` (Grupo 2, vía `creditos`);
  `empresa_id`+`tienda_id` en `aplicaciones_pago` (Grupo 3, doble padre
  `pagos`+`cuotas`, con validación cruzada); `empresa_id`+`tienda_id` en
  `links.solicitud_credito` (Grupo 3, doble padre `solicitudes`+`creditos`).

- [ ] **Step 1: Escribir la migración**

```sql
-- =============================================================================
-- cartera + links: empresa_id/tienda_id en creditos, cuotas, pagos,
-- aplicaciones_pago (doble padre), links.solicitud_credito (doble padre).
-- =============================================================================

-- --- creditos (Grupo 1: ya tiene tienda_id) ---

alter table cartera.creditos add column empresa_id uuid;

update cartera.creditos c
set empresa_id = t.empresa_id
from public.tiendas t
where t.id = c.tienda_id;

create or replace function cartera.derivar_tenencia_credito()
returns trigger as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from public.tiendas where id = new.tienda_id;
  if v_empresa_id is null then
    raise exception 'tienda_id % no existe en public.tiendas', new.tienda_id;
  end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de crédito (%) no coincide con la tienda (%)',
      new.empresa_id, v_empresa_id;
  end if;
  new.empresa_id := v_empresa_id;
  return new;
end;
$$ language plpgsql;

create trigger creditos_derivar_tenencia
  before insert on cartera.creditos
  for each row execute function cartera.derivar_tenencia_credito();

alter table cartera.creditos alter column empresa_id set not null;

drop policy creditos_lectura on cartera.creditos;
create policy creditos_lectura on cartera.creditos
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );

drop policy creditos_registro on cartera.creditos;
create policy creditos_registro on cartera.creditos
  for insert to authenticated
  with check (rol_actual() = any (array['manager'::rol_usuario, 'financiero'::rol_usuario]));

-- --- cuotas (Grupo 2: hija de creditos) ---

alter table cartera.cuotas add column empresa_id uuid;
alter table cartera.cuotas add column tienda_id uuid;

update cartera.cuotas q
set empresa_id = c.empresa_id, tienda_id = c.tienda_id
from cartera.creditos c
where c.id = q.credito_id;

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

alter table cartera.cuotas alter column empresa_id set not null;
alter table cartera.cuotas alter column tienda_id set not null;

drop policy cuotas_lectura on cartera.cuotas;
create policy cuotas_lectura on cartera.cuotas
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );
-- cuotas_actualizacion se mantiene igual (UPDATE de acumulados por id ya
-- conocido internamente por el workflow de pago).

-- --- pagos (Grupo 2: hija de creditos) ---

alter table cartera.pagos add column empresa_id uuid;
alter table cartera.pagos add column tienda_id uuid;

update cartera.pagos p
set empresa_id = c.empresa_id, tienda_id = c.tienda_id
from cartera.creditos c
where c.id = p.credito_id;

create or replace function cartera.derivar_tenencia_pago()
returns trigger as $$
declare
  v_empresa_id uuid;
  v_tienda_id uuid;
begin
  select empresa_id, tienda_id into v_empresa_id, v_tienda_id
  from cartera.creditos where id = new.credito_id;

  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de pago (%) no coincide con el crédito padre (%)',
      new.empresa_id, v_empresa_id;
  end if;
  if new.tienda_id is not null and new.tienda_id <> v_tienda_id then
    raise exception 'tienda_id de pago (%) no coincide con el crédito padre (%)',
      new.tienda_id, v_tienda_id;
  end if;

  new.empresa_id := v_empresa_id;
  new.tienda_id := v_tienda_id;
  return new;
end;
$$ language plpgsql;

create trigger pagos_derivar_tenencia
  before insert on cartera.pagos
  for each row execute function cartera.derivar_tenencia_pago();

alter table cartera.pagos alter column empresa_id set not null;
alter table cartera.pagos alter column tienda_id set not null;

drop policy pagos_lectura on cartera.pagos;
create policy pagos_lectura on cartera.pagos
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );

-- --- aplicaciones_pago (Grupo 3: doble padre pagos + cuotas) ---

alter table cartera.aplicaciones_pago add column empresa_id uuid;
alter table cartera.aplicaciones_pago add column tienda_id uuid;

update cartera.aplicaciones_pago a
set empresa_id = p.empresa_id, tienda_id = p.tienda_id
from cartera.pagos p
where p.id = a.pago_id;

create or replace function cartera.derivar_tenencia_aplicacion_pago()
returns trigger as $$
declare
  v_empresa_id_pago uuid;
  v_tienda_id_pago uuid;
  v_empresa_id_cuota uuid;
begin
  select empresa_id, tienda_id into v_empresa_id_pago, v_tienda_id_pago
  from cartera.pagos where id = new.pago_id;

  select empresa_id into v_empresa_id_cuota
  from cartera.cuotas where id = new.cuota_id;

  if v_empresa_id_cuota <> v_empresa_id_pago then
    raise exception 'la cuota (empresa %) y el pago (empresa %) de esta aplicación no son de la misma empresa',
      v_empresa_id_cuota, v_empresa_id_pago;
  end if;

  if new.empresa_id is not null and new.empresa_id <> v_empresa_id_pago then
    raise exception 'empresa_id de aplicación de pago (%) no coincide con el pago padre (%)',
      new.empresa_id, v_empresa_id_pago;
  end if;
  if new.tienda_id is not null and new.tienda_id <> v_tienda_id_pago then
    raise exception 'tienda_id de aplicación de pago (%) no coincide con el pago padre (%)',
      new.tienda_id, v_tienda_id_pago;
  end if;

  new.empresa_id := v_empresa_id_pago;
  new.tienda_id := v_tienda_id_pago;
  return new;
end;
$$ language plpgsql;

create trigger aplicaciones_pago_derivar_tenencia
  before insert on cartera.aplicaciones_pago
  for each row execute function cartera.derivar_tenencia_aplicacion_pago();

alter table cartera.aplicaciones_pago alter column empresa_id set not null;
alter table cartera.aplicaciones_pago alter column tienda_id set not null;

drop policy aplicaciones_lectura on cartera.aplicaciones_pago;
create policy aplicaciones_lectura on cartera.aplicaciones_pago
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );

-- --- links.solicitud_credito (Grupo 3: doble padre solicitudes + creditos) ---

alter table links.solicitud_credito add column empresa_id uuid;
alter table links.solicitud_credito add column tienda_id uuid;

update links.solicitud_credito lk
set empresa_id = c.empresa_id, tienda_id = c.tienda_id
from cartera.creditos c
where c.id = lk.credito_id;

create or replace function links.derivar_tenencia_solicitud_credito()
returns trigger as $$
declare
  v_empresa_id_credito uuid;
  v_tienda_id_credito uuid;
  v_empresa_id_solicitud uuid;
begin
  select empresa_id, tienda_id into v_empresa_id_credito, v_tienda_id_credito
  from cartera.creditos where id = new.credito_id;

  select empresa_id into v_empresa_id_solicitud
  from originacion.solicitudes where id = new.solicitud_id;

  if v_empresa_id_solicitud <> v_empresa_id_credito then
    raise exception 'la solicitud (empresa %) y el crédito (empresa %) de este vínculo no son de la misma empresa',
      v_empresa_id_solicitud, v_empresa_id_credito;
  end if;

  if new.empresa_id is not null and new.empresa_id <> v_empresa_id_credito then
    raise exception 'empresa_id del vínculo (%) no coincide con el crédito (%)',
      new.empresa_id, v_empresa_id_credito;
  end if;
  if new.tienda_id is not null and new.tienda_id <> v_tienda_id_credito then
    raise exception 'tienda_id del vínculo (%) no coincide con el crédito (%)',
      new.tienda_id, v_tienda_id_credito;
  end if;

  new.empresa_id := v_empresa_id_credito;
  new.tienda_id := v_tienda_id_credito;
  return new;
end;
$$ language plpgsql;

create trigger solicitud_credito_derivar_tenencia
  before insert on links.solicitud_credito
  for each row execute function links.derivar_tenencia_solicitud_credito();

alter table links.solicitud_credito alter column empresa_id set not null;
alter table links.solicitud_credito alter column tienda_id set not null;

drop policy links_sc_lectura on links.solicitud_credito;
create policy links_sc_lectura on links.solicitud_credito
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    case rol_actual()
      when 'vendedor' then tienda_id = tienda_actual()
      when 'manager' then tienda_id = tienda_actual()
      else rol_actual() is not null
    end
  );
```

- [ ] **Step 2: Aplicar**

Run: `pnpm supabase migration up`
Expected: sin errores.

- [ ] **Step 3: Verificar backfill**

```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select
    (select count(*) from cartera.creditos where empresa_id is null) as creditos,
    (select count(*) from cartera.cuotas where empresa_id is null or tienda_id is null) as cuotas,
    (select count(*) from cartera.pagos where empresa_id is null or tienda_id is null) as pagos,
    (select count(*) from cartera.aplicaciones_pago where empresa_id is null or tienda_id is null) as aplicaciones,
    (select count(*) from links.solicitud_credito where empresa_id is null or tienda_id is null) as links;"
```
Expected: las 5 columnas en `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260728000000_cartera_empresa_id.sql
git commit -m "feat(cartera): empresa_id/tienda_id en creditos, cuotas, pagos, aplicaciones_pago, links.solicitud_credito"
```

---

### Task 6: Dominio + contrato + repositorio — `cartera`

**Files:**
- Modify: `packages/core/modules/cartera/domain/credit.ts`
- Modify: `packages/core/modules/cartera/domain/repositories.ts`
- Modify: `packages/core/modules/cartera/infrastructure/supabase-repositories.ts`

**Interfaces:**
- Produces: `Credito.empresaId?: string` (solo lectura, el trigger lo
  deriva); `RepositorioCreditos.buscarPorId(empresaId, creditoId)`,
  `.cuotasDeCredito(empresaId, creditoId)`.

- [ ] **Step 1: `domain/credit.ts`**

```typescript
export interface Credito {
  id?: string;
  empresaId?: string; // solo lectura: el trigger de cascada lo deriva, la app nunca lo setea
  clienteId: string;
  tiendaId: string;
  montoDesembolsadoCentavos: number;
  tasaEA: number;
  tasaMoraEA: number;
  plazoMeses: number;
  cuotaCentavos: number;
  estado: "activo" | "cancelado";
  desembolsadoEn: string;
}
```

- [ ] **Step 2: `domain/repositories.ts`**

```typescript
export interface RepositorioCreditos {
  guardar(credito: Credito): Promise<Credito>;
  eliminar(creditoId: string): Promise<void>;
  buscarPorId(empresaId: string, creditoId: string): Promise<Credito | null>;
  guardarCuotas(creditoId: string, cuotas: Cuota[]): Promise<Cuota[]>;
  eliminarCuotasDeCredito(creditoId: string): Promise<void>;
  cuotasDeCredito(empresaId: string, creditoId: string): Promise<Cuota[]>;
  vincularSolicitud(solicitudId: string, creditoId: string): Promise<void>;
  desvincularSolicitud(solicitudId: string, creditoId: string): Promise<void>;
}
```
(`RepositorioPagos` no cambia — `guardar`/`actualizarAcumulados`/
`eliminar` son escritura vía trigger o UPDATE por id ya conocido.)

- [ ] **Step 3: `infrastructure/supabase-repositories.ts`**

```typescript
async buscarPorId(empresaId: string, creditoId: string): Promise<Credito | null> {
  const { data, error } = await this.supabase
    .schema("cartera")
    .from("creditos")
    .select()
    .eq("id", creditoId)
    .eq("empresa_id", empresaId)
    .maybeSingle<FilaCredito>();
  if (error) throw new Error(`[cartera] error buscando crédito: ${error.message}`);
  return data ? aCredito(data) : null;
}

async cuotasDeCredito(empresaId: string, creditoId: string): Promise<Cuota[]> {
  const { data, error } = await this.supabase
    .schema("cartera")
    .from("cuotas")
    .select()
    .eq("credito_id", creditoId)
    .eq("empresa_id", empresaId)
    .order("numero")
    .returns<FilaCuota[]>();
  if (error) throw new Error(`[cartera] error leyendo cuotas: ${error.message}`);
  return (data ?? []).map(aCuota);
}
```
(`guardar` de `creditos`/`cuotas`/`pagos`/`aplicaciones_pago` no cambian
de query — el trigger completa `empresa_id`/`tienda_id`. `aCredito`
(mapper) gana `empresaId: fila.empresa_id` en la traducción de LECTURA
únicamente — nunca se envía en `aFilaNueva` para el INSERT, dado que
`Credito.empresaId` es opcional/solo lectura.)

- [ ] **Step 4: Typecheck del core**

Run: `pnpm --filter @sumo/core typecheck`
Expected: errores en `register-payment.ts` (llama `buscarPorId`/
`cuotasDeCredito` sin `empresaId`) y en los tests con fixtures
`implements RepositorioCreditos` — se resuelven en Task 7.

- [ ] **Step 5: Commit**

```bash
git add packages/core/modules/cartera/domain/credit.ts \
  packages/core/modules/cartera/domain/repositories.ts \
  packages/core/modules/cartera/infrastructure/supabase-repositories.ts
git commit -m "feat(cartera): Credito.empresaId + empresaId obligatorio en lecturas del repositorio"
```

---

### Task 7: Integración cruzada `cartera`↔`originacion` + call site + tests

**Files:**
- Modify: `packages/core/modules/cartera/domain/approved-application-source.ts`
- Modify: `packages/core/modules/cartera/application/disburse-approved-application.ts`
- Modify: `packages/core/modules/cartera/application/register-payment.ts`
- Modify: `packages/core/modules/cartera/module.ts`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/actions.ts`
- Modify: `packages/core/modules/cartera/application/disburse-approved-application.test.ts`
- Modify: `packages/core/modules/cartera/application/register-payment.test.ts`
- Modify: `packages/core/flow.e2e.test.ts`

**Interfaces:**
- Consumes: `OriginacionService.paraDesembolso(empresaId, solicitudId)`
  (Task 2), `RepositorioCreditos.buscarPorId(empresaId, creditoId)`/
  `.cuotasDeCredito(empresaId, creditoId)` (Task 6).
- Produces: `ComandoDesembolsarSolicitud.empresaId: string`,
  `ComandoRegistrarPago.empresaId: string`,
  `FuenteSolicitudesAprobadas.paraDesembolso(empresaId, solicitudId)`.

**Contexto:** el rastreo confirmó la cadena real: la acción del backoffice
llama `carteraService().desembolsarSolicitudAprobada(comando)`, que
internamente llama `this.solicitudes.paraDesembolso(solicitudId)` — el
puerto `FuenteSolicitudesAprobadas`, implementado en `cartera/module.ts`
como un adaptador que resuelve `OriginacionService` del container y
delega a `.paraDesembolso(solicitudId)`. Como ese método ahora exige
`empresaId` (Task 2), la cadena completa necesita el campo.

- [ ] **Step 1: `domain/approved-application-source.ts`**

```typescript
export interface FuenteSolicitudesAprobadas {
  paraDesembolso(empresaId: string, solicitudId: string): Promise<SolicitudParaDesembolso | null>;
}
```

- [ ] **Step 2: `application/disburse-approved-application.ts`**

```typescript
export interface ComandoDesembolsarSolicitud {
  empresaId: string;
  solicitudId: string;
  fechaDesembolso: string; // ISO yyyy-mm-dd
}

export class DesembolsarSolicitudAprobada {
  constructor(
    private readonly solicitudes: FuenteSolicitudesAprobadas,
    private readonly casoDesembolsar: EjecutorDesembolso,
  ) {}

  async ejecutar(
    comando: ComandoDesembolsarSolicitud,
  ): Promise<Resultado<CreditoDesembolsado, string>> {
    const solicitud = await this.solicitudes.paraDesembolso(comando.empresaId, comando.solicitudId);
    // ... resto del método sin cambios (usa solicitud.tiendaId, solicitud.clienteId, etc.)
  }
}
```

- [ ] **Step 3: `application/register-payment.ts`**

```typescript
export interface ComandoRegistrarPago {
  empresaId: string;
  creditoId: string;
  montoCentavos: number;
  fechaPago: string;
}
```
Dentro de `ejecutar`:
```typescript
// antes
const credito = await this.creditos.buscarPorId(comando.creditoId);
// ...
const cuotas = await this.creditos.cuotasDeCredito(comando.creditoId);

// después
const credito = await this.creditos.buscarPorId(comando.empresaId, comando.creditoId);
// ...
const cuotas = await this.creditos.cuotasDeCredito(comando.empresaId, comando.creditoId);
```

- [ ] **Step 4: `module.ts` (cartera)**

```typescript
const fuenteSolicitudes: FuenteSolicitudesAprobadas = {
  paraDesembolso: (empresaId, solicitudId) =>
    (container.get(TOKENS.originacionService) as OriginacionService)
      .paraDesembolso(empresaId, solicitudId),
};
```

- [ ] **Step 5: `apps/backoffice/app/(financiero)/desembolsos/actions.ts`**

```typescript
// antes
export async function desembolsarSolicitud(formData: FormData): Promise<void> {
  await sesionDeFinanciero();

  const solicitudId = String(formData.get("solicitudId") ?? "");
  const resultado = await carteraService().desembolsarSolicitudAprobada({
    solicitudId,
    fechaDesembolso: FECHA_BOGOTA.format(new Date()),
  });
  ...
}

// después
export async function desembolsarSolicitud(formData: FormData): Promise<void> {
  const sesion = await sesionDeFinanciero();

  const solicitudId = String(formData.get("solicitudId") ?? "");
  const resultado = await carteraService().desembolsarSolicitudAprobada({
    empresaId: sesion.empresaId,
    solicitudId,
    fechaDesembolso: FECHA_BOGOTA.format(new Date()),
  });
  ...
}
```

- [ ] **Step 6: `disburse-approved-application.test.ts`**

```typescript
const APROBADA: SolicitudParaDesembolso = {
  solicitudId: "sol-1",
  clienteId: "cli-1",
  tiendaId: "tienda-1",
  plazoMeses: 24,
  montoAFinanciarCentavos: 600_000_000,
  tasaEA: 0.245,
  aprobada: true,
  estado: "evaluada",
  verificacionCompleta: true,
  verificacionRazones: ["completitud 100/100 puntos — cumple el mínimo"],
};

function armar(solicitud: SolicitudParaDesembolso | null) {
  const fuente: FuenteSolicitudesAprobadas = {
    paraDesembolso: async () => solicitud,
  };
  ...
}
```
Los 5 `caso.ejecutar({ solicitudId: "sol-1", fechaDesembolso: "2026-07-15" })`
pasan a `caso.ejecutar({ empresaId: "empresa-1", solicitudId: "sol-1", fechaDesembolso: "2026-07-15" })`.
(`armar` no necesita cambio — su stub `paraDesembolso: async () => solicitud`
ignora argumentos igual que antes.)

- [ ] **Step 7: `register-payment.test.ts`**

`class CreditosFijos implements RepositorioCreditos` gana los parámetros
nuevos en `buscarPorId`/`cuotasDeCredito` (mismo patrón que Task 4, Step 2
para `originacion` — primer parámetro `_empresaId: string` ignorado si el
fixture no lo necesita). Los `casoRegistrarPago.ejecutar({ creditoId,
montoCentavos, fechaPago })` del archivo pasan a incluir `empresaId:
"empresa-1"`.

- [ ] **Step 8: `flow.e2e.test.ts`**

```typescript
// antes (línea ~69)
const desembolso = await cartera.desembolsarCredito({ ... }); // sin cambio, Group 1 vía trigger

// antes (línea ~89)
const pago = await cartera.registrarPago({
  creditoId,
  montoCentavos: desembolso.valor.credito.cuotaCentavos,
  fechaPago: new Date().toISOString().slice(0, 10),
});

// después
const pago = await cartera.registrarPago({
  empresaId: EMPRESA,
  creditoId,
  montoCentavos: desembolso.valor.credito.cuotaCentavos,
  fechaPago: new Date().toISOString().slice(0, 10),
});
```
(`desembolsarCredito` no necesita cambio — `ComandoDesembolsarCredito` no
se tocó, sigue recibiendo `tiendaId` explícito, Grupo 1 vía trigger.)

- [ ] **Step 9: Typecheck + suite unitaria + e2e**

Run: `pnpm --filter @sumo/core typecheck && pnpm --filter backoffice exec tsc --noEmit`
Expected: cero errores.

Run: `pnpm --filter @sumo/core test`
Expected: 138/138.

Run (con llaves exportadas):
```bash
pnpm --filter @sumo/core exec vitest run flow.e2e.test.ts --config vitest.e2e.config.ts
```
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/core/modules/cartera/domain/approved-application-source.ts \
  packages/core/modules/cartera/application/disburse-approved-application.ts \
  packages/core/modules/cartera/application/register-payment.ts \
  packages/core/modules/cartera/module.ts \
  "apps/backoffice/app/(financiero)/desembolsos/actions.ts" \
  packages/core/modules/cartera/application/disburse-approved-application.test.ts \
  packages/core/modules/cartera/application/register-payment.test.ts \
  packages/core/flow.e2e.test.ts
git commit -m "feat(cartera): empresaId en la integración con originacion (paraDesembolso) y en registrarPago"
```

---

### Task 8: Suite de aislamiento + validación de trigger de doble padre — `cartera`+`links`

**Files:**
- Create: `packages/core/aislamiento-cartera.e2e.test.ts`

**Interfaces:**
- Consumes: `CarteraService`/`RepositorioCreditos` resueltos del container real.

- [ ] **Step 1: Escribir el test**

Mismo patrón de fixture que `aislamiento-reporteria.e2e.test.ts` (empresa
rival + tienda + cliente + crédito + cuota vía `service_role`), con dos
aserciones adicionales específicas de este módulo: aislamiento de lectura
vía `RepositorioCreditos.buscarPorId`, y control negativo del trigger de
doble padre en `aplicaciones_pago` (un pago de un crédito aplicado contra
una cuota de OTRO crédito — el caso real que la validación cruzada debe
atrapar).

```typescript
// Aislamiento entre tenants para cartera — repositorio + validación de
// trigger de doble padre en aplicaciones_pago.
// Se corre manualmente:
// npx vitest run aislamiento-cartera.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { CarteraService } from "./modules/cartera/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const EMPRESA_SUMOTO = "d0000000-0000-4000-8000-000000000001";
const SUFIJO = Date.now().toString(36);

describe("aislamiento entre empresas — cartera", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let creditoRival: string;
  let creditoSumoto: string;
  let cuotaSumoto: string;

  beforeAll(async () => {
    arrancarNucleo({ supabase });

    const { data: empresa } = await supabase
      .from("empresas")
      .insert({ nombre: "Rival Cartera S.A.S.", slug: `rival-cartera-${SUFIJO}` })
      .select("id")
      .single();
    empresaRival = empresa!.id;

    const { data: tienda } = await supabase
      .from("tiendas")
      .insert({ nombre: "Rival Cartera Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    tiendaRival = tienda!.id;

    const { data: clienteRival } = await supabase
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: `23${Date.now().toString().slice(-8)}`,
        nombres: "Rita",
        apellidos: "Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();

    const { data: credito } = await supabase
      .schema("cartera")
      .from("creditos")
      .insert({
        cliente_id: clienteRival!.id,
        tienda_id: tiendaRival,
        monto_desembolsado_centavos: 500_000_000,
        tasa_ea: 0.245,
        tasa_mora_ea: 0.38,
        plazo_meses: 12,
        cuota_centavos: 47_000_000,
        desembolsado_en: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    creditoRival = credito!.id;

    // crédito + cuota REALES de SUMOTO (seed) para el control negativo de doble padre
    const { data: creditoSumotoRow } = await supabase
      .schema("cartera")
      .from("creditos")
      .select("id")
      .eq("empresa_id", EMPRESA_SUMOTO)
      .limit(1)
      .single();
    creditoSumoto = creditoSumotoRow!.id;

    const { data: cuotaSumotoRow } = await supabase
      .schema("cartera")
      .from("cuotas")
      .select("id")
      .eq("credito_id", creditoSumoto)
      .limit(1)
      .single();
    cuotaSumoto = cuotaSumotoRow!.id;
  });

  it("SUMOTO nunca ve el crédito de la empresa rival", async () => {
    const cartera = resolver<CarteraService>(TOKENS.carteraService);
    // CarteraService no expone lectura hoy — se prueba vía el repositorio
    // resuelto directo del container (mismo patrón permitido en tests e2e
    // del core, ver flow.e2e.test.ts).
    const creditos = resolver<import("./modules/cartera/domain/repositories").RepositorioCreditos>(
      TOKENS.repositorioCreditos,
    );
    const credito = await creditos.buscarPorId(EMPRESA_SUMOTO, creditoRival);
    expect(credito).toBeNull();
  });

  it("la empresa rival SÍ ve su propio crédito", async () => {
    const creditos = resolver<import("./modules/cartera/domain/repositories").RepositorioCreditos>(
      TOKENS.repositorioCreditos,
    );
    const credito = await creditos.buscarPorId(empresaRival, creditoRival);
    expect(credito).not.toBeNull();
  });

  it("el trigger de aplicaciones_pago RECHAZA cruzar un pago del crédito rival con una cuota de SUMOTO", async () => {
    const { data: pagoRival } = await supabase
      .schema("cartera")
      .from("pagos")
      .insert({
        credito_id: creditoRival,
        monto_centavos: 10_000_000,
        fecha_pago: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    const { error } = await supabase
      .schema("cartera")
      .from("aplicaciones_pago")
      .insert({
        pago_id: pagoRival!.id,
        cuota_id: cuotaSumoto, // deliberadamente de OTRO crédito/empresa
        componente: "capital",
        monto_centavos: 10_000_000,
      });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/no son de la misma empresa/);
  });
});
```

**Nota:** si `TOKENS.repositorioCreditos` no existe como token DI público
(verificar en `packages/core/kernel/container.ts` — puede que el
repositorio se registre solo internamente dentro de `cartera/module.ts`
sin exponer un token propio), usar en su lugar `CarteraService` con un
método de lectura si Task 6/7 decidió exponer uno, o resolver el
repositorio construyendo `new RepositorioCreditosSupabase(supabase)`
directo en el test (mismo criterio que otros tests e2e cuando no hay
fachada pública para lo que se quiere probar). Confirmar contra el código
real antes de escribir esta parte — no asumir el nombre del token.

- [ ] **Step 2: Correr y confirmar**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core exec vitest run aislamiento-cartera.e2e.test.ts --config vitest.e2e.config.ts
```
Expected: 3/3 PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/aislamiento-cartera.e2e.test.ts
git commit -m "test(cartera): suite de aislamiento + validación de trigger de doble padre"
```

---

## Módulo `contabilidad`

### Task 9: Migración SQL + dominio/suscriptor/repositorio — `contabilidad`

**Files:**
- Create: `supabase/migrations/20260729000000_contabilidad_empresa_id.sql`
- Modify: `packages/core/modules/contabilidad/domain/journal-entry.ts`
- Modify: `packages/core/modules/contabilidad/domain/entry-templates.ts`
- Modify: `packages/core/modules/contabilidad/subscribers/on-cartera-events.ts`
- Modify: `packages/core/modules/contabilidad/infrastructure/supabase-entry-repository.ts`
- Modify: `packages/core/modules/contabilidad/module.ts`

**Interfaces:**
- Consumes: el evento `cartera.credito.desembolsado`/`cartera.pago.registrado`
  YA trae `tiendaId` en el payload real (confirmado en
  `disburse-credit.ts:107-115`/`register-payment.ts:112-121`), aunque los
  tipos `PayloadDesembolso`/`PayloadPago` del suscriptor todavía no lo
  declaran.
- Produces: `AsientoContable.empresaId: string`; `asientos.empresa_id` en
  DB (sin trigger — lo resuelve el suscriptor); cierra el gap
  `asientos_recientes` que dejó pendiente la spec de `reporteria`.

- [ ] **Step 1: Migración SQL**

```sql
-- =============================================================================
-- contabilidad: empresa_id en asientos (SIN trigger — no hay FK real a
-- cartera, referencia polimórfica; lo resuelve el suscriptor) y partidas
-- (Grupo 2 normal, hija de asientos vía FK real, CON trigger).
-- =============================================================================

alter table contabilidad.asientos add column empresa_id uuid;

update contabilidad.asientos
set empresa_id = 'd0000000-0000-4000-8000-000000000001'
where empresa_id is null;
-- backfill: hoy solo existe la empresa SUMOTO con asientos reales; el
-- suscriptor resolverá empresa_id correctamente para TODO asiento nuevo
-- a partir de aquí.

alter table contabilidad.asientos alter column empresa_id set not null;

drop policy asientos_lectura on contabilidad.asientos;
create policy asientos_lectura on contabilidad.asientos
  for select to authenticated
  using (
    rol_actual() = any (array['contable'::rol_usuario, 'financiero'::rol_usuario, 'ceo'::rol_usuario])
    and empresa_id = empresa_actual()
  );

drop policy asientos_registro on contabilidad.asientos;
create policy asientos_registro on contabilidad.asientos
  for insert to authenticated
  with check (
    rol_actual() = any (array['contable'::rol_usuario, 'financiero'::rol_usuario])
    and empresa_id = empresa_actual()
  );

drop policy asientos_actualizacion on contabilidad.asientos;
create policy asientos_actualizacion on contabilidad.asientos
  for update to authenticated
  using (
    rol_actual() = any (array['contable'::rol_usuario, 'financiero'::rol_usuario])
    and empresa_id = empresa_actual()
  );

-- partidas (Grupo 2: hija de asientos, FK real)

alter table contabilidad.partidas add column empresa_id uuid;

update contabilidad.partidas p
set empresa_id = a.empresa_id
from contabilidad.asientos a
where a.id = p.asiento_id;

create or replace function contabilidad.derivar_tenencia_partida()
returns trigger as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from contabilidad.asientos where id = new.asiento_id;
  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de partida (%) no coincide con el asiento padre (%)',
      new.empresa_id, v_empresa_id;
  end if;
  new.empresa_id := v_empresa_id;
  return new;
end;
$$ language plpgsql;

create trigger partidas_derivar_tenencia
  before insert on contabilidad.partidas
  for each row execute function contabilidad.derivar_tenencia_partida();

alter table contabilidad.partidas alter column empresa_id set not null;

drop policy partidas_lectura on contabilidad.partidas;
create policy partidas_lectura on contabilidad.partidas
  for select to authenticated
  using (
    rol_actual() = any (array['contable'::rol_usuario, 'financiero'::rol_usuario, 'ceo'::rol_usuario])
    and empresa_id = empresa_actual()
  );

drop policy partidas_registro on contabilidad.partidas;
create policy partidas_registro on contabilidad.partidas
  for insert to authenticated
  with check (
    rol_actual() = any (array['contable'::rol_usuario, 'financiero'::rol_usuario])
    and empresa_id = empresa_actual()
  );
```

- [ ] **Step 2: Aplicar y verificar**

Run: `pnpm supabase migration up`

```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select
    (select count(*) from contabilidad.asientos where empresa_id is null) as asientos,
    (select count(*) from contabilidad.partidas where empresa_id is null) as partidas;"
```
Expected: `0`, `0`.

- [ ] **Step 3: `domain/journal-entry.ts`**

```typescript
export interface AsientoContable {
  id?: string;
  empresaId: string;
  fecha: string;
  descripcion: string;
  eventoOrigen: string;
  referenciaId: string;
  partidas: Partida[];
}
```
(`Partida` NO cambia — no lleva `empresa_id` propio en el dominio, el
trigger lo deriva silenciosamente en DB desde `asiento_id`; `crearAsiento`
no cambia de lógica, solo el tipo que recibe/retorna ya incluye
`empresaId`.)

- [ ] **Step 4: `domain/entry-templates.ts`**

```typescript
export interface HechoDesembolso {
  empresaId: string;
  creditoId: string;
  montoCentavos: number;
  fecha: string;
}

export interface HechoPago {
  empresaId: string;
  pagoId: string;
  montoCentavos: number;
  capitalCentavos: number;
  interesCentavos: number;
  moraCentavos: number;
  sobranteCentavos: number;
  fecha: string;
}
```
`asientoDeDesembolso`/`asientoDePago` incluyen `empresaId: hecho.empresaId`
en el objeto que arman para `crearAsiento` (el resto de su lógica no
cambia).

- [ ] **Step 5: `subscribers/on-cartera-events.ts`**

```typescript
interface PayloadDesembolso {
  creditoId: string;
  tiendaId: string;
  montoCentavos: number;
  fecha?: string;
}

interface PayloadPago {
  pagoId: string;
  tiendaId: string;
  montoCentavos: number;
  capital: number;
  interes: number;
  mora: number;
  sobranteCentavos: number;
  fecha?: string;
}

async function resolverEmpresaId(supabase: SupabaseClient, tiendaId: string): Promise<string> {
  const { data, error } = await supabase
    .from("tiendas")
    .select("empresa_id")
    .eq("id", tiendaId)
    .single<{ empresa_id: string }>();
  if (error) throw new Error(`[contabilidad] error resolviendo empresa de la tienda: ${error.message}`);
  return data.empresa_id;
}

export function alDesembolsarCredito(registrar: ContabilidadService, supabase: SupabaseClient) {
  return async (evento: unknown): Promise<void> => {
    const { payload } = evento as EventoDominio<PayloadDesembolso>;
    const empresaId = await resolverEmpresaId(supabase, payload.tiendaId);
    const asiento = asientoDeDesembolso({
      empresaId,
      creditoId: payload.creditoId,
      montoCentavos: payload.montoCentavos,
      fecha: payload.fecha ?? hoyIso(),
    });
    if (!asiento.ok) {
      console.error(`[contabilidad] asiento de desembolso inválido:`, asiento.error);
      return;
    }
    await registrar.registrarAsiento(asiento.valor);
  };
}

export function alRegistrarPago(registrar: ContabilidadService, supabase: SupabaseClient) {
  return async (evento: unknown): Promise<void> => {
    const { payload } = evento as EventoDominio<PayloadPago>;
    const empresaId = await resolverEmpresaId(supabase, payload.tiendaId);
    const asiento = asientoDePago({
      empresaId,
      pagoId: payload.pagoId,
      montoCentavos: payload.montoCentavos,
      capitalCentavos: payload.capital,
      interesCentavos: payload.interes,
      moraCentavos: payload.mora,
      sobranteCentavos: payload.sobranteCentavos,
      fecha: payload.fecha ?? hoyIso(),
    });
    if (!asiento.ok) {
      console.error(`[contabilidad] asiento de pago inválido:`, asiento.error);
      return;
    }
    await registrar.registrarAsiento(asiento.valor);
  };
}
```
(Import nuevo: `import type { SupabaseClient } from "@supabase/supabase-js";`
al inicio del archivo. Ajustar los nombres de campo `payload.capital`/
`payload.interes`/`payload.mora` contra el shape real del evento —
verificar en `register-payment.ts:112-121` los nombres exactos de las
propiedades que se spreaden con `...totales`, no asumirlos.)

- [ ] **Step 6: `infrastructure/supabase-entry-repository.ts`**

```typescript
async guardarEncabezado(asiento: AsientoContable): Promise<AsientoContable> {
  const { data, error } = await this.supabase
    .schema("contabilidad")
    .from("asientos")
    .insert({
      empresa_id: asiento.empresaId,
      fecha: asiento.fecha,
      descripcion: asiento.descripcion,
      evento_origen: asiento.eventoOrigen,
      referencia_id: asiento.referenciaId,
    })
    .select()
    .single<{ id: string }>();
  if (error) throw new Error(`[contabilidad] error guardando asiento: ${error.message}`);
  return { ...asiento, id: data.id };
}
```
(`guardarPartidas` no cambia — `partidas` no lleva `empresa_id` explícito
en el insert, el trigger lo deriva de `asiento_id`.)

- [ ] **Step 7: `module.ts` (contabilidad)**

Pasar el `SupabaseClient` a las fábricas del suscriptor al armar las
suscripciones:

```typescript
// antes (en suscripciones() o donde se registren los oídos)
bus.on("cartera.credito.desembolsado", alDesembolsarCredito(contabilidadServiceInstancia));
bus.on("cartera.pago.registrado", alRegistrarPago(contabilidadServiceInstancia));

// después
const supabase = container.get(TOKENS.supabase) as SupabaseClient;
bus.on("cartera.credito.desembolsado", alDesembolsarCredito(contabilidadServiceInstancia, supabase));
bus.on("cartera.pago.registrado", alRegistrarPago(contabilidadServiceInstancia, supabase));
```
(Verificar la forma exacta actual de `module.ts` antes de aplicar — el
patrón de dos pasadas del kernel, `registrar()`/`suscripciones()`, ya
existe; localizar dónde se llaman `alDesembolsarCredito`/
`alRegistrarPago` hoy y agregar el segundo argumento ahí.)

- [ ] **Step 8: Typecheck del core**

Run: `pnpm --filter @sumo/core typecheck`
Expected: errores en `on-cartera-events.test.ts` (payloads sin `tiendaId`,
`armar()` sin el segundo parámetro) — se resuelven en Task 10.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260729000000_contabilidad_empresa_id.sql \
  packages/core/modules/contabilidad/domain/journal-entry.ts \
  packages/core/modules/contabilidad/domain/entry-templates.ts \
  packages/core/modules/contabilidad/subscribers/on-cartera-events.ts \
  packages/core/modules/contabilidad/infrastructure/supabase-entry-repository.ts \
  packages/core/modules/contabilidad/module.ts
git commit -m "feat(contabilidad): empresa_id en asientos/partidas — cierra el gap de asientos_recientes"
```

---

### Task 10: Tests — `contabilidad`

**Files:**
- Modify: `packages/core/modules/contabilidad/subscribers/on-cartera-events.test.ts`

**Interfaces:**
- Consumes: firmas de la Task 9.

- [ ] **Step 1: Actualizar `armar()` y los payloads de prueba**

```typescript
function armar(wo: SistemaContable) {
  const asientos = new AsientosEnMemoria();
  const registrar = new ContabilidadService(new RegistrarAsiento(asientos, wo));
  const bus = new EventBus();
  const supabaseFalso = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { empresa_id: "empresa-1" }, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  bus.on("cartera.credito.desembolsado", alDesembolsarCredito(registrar, supabaseFalso));
  bus.on("cartera.pago.registrado", alRegistrarPago(registrar, supabaseFalso));
  return { asientos, bus };
}
```

Cada `bus.emit("cartera.credito.desembolsado", {...})`/`bus.emit("cartera.pago.registrado", {...})`
de los 5 casos gana `tiendaId: "tienda-1"` en el payload emitido.

Agregar una aserción en al menos un caso confirmando que el asiento
guardado en `asientos.guardados[0]` tiene `empresaId: "empresa-1"` (el
valor que devuelve el mock de `supabaseFalso`).

- [ ] **Step 2: Correr**

Run: `pnpm --filter @sumo/core test`
Expected: 138/138 (o el conteo vigente en ese momento del plan — no debe
haber regresiones).

- [ ] **Step 3: Commit**

```bash
git add packages/core/modules/contabilidad/subscribers/on-cartera-events.test.ts
git commit -m "test(contabilidad): mock de resolución de empresaId en on-cartera-events"
```

---

## Módulo `catalogo`

### Task 11: Migración SQL — `catalogo`

**Files:**
- Create: `supabase/migrations/20260730000000_catalogo_empresa_id.sql`

**Interfaces:**
- Produces: `empresa_id` en `motos` (Grupo 4, sin trigger, sin
  `tienda_id` — el catálogo es de alcance nacional dentro de cada
  empresa, no por tienda).

- [ ] **Step 1: Escribir la migración**

```sql
-- =============================================================================
-- catalogo: empresa_id en motos (Grupo 4, sin padre derivable, sin trigger).
-- =============================================================================

alter table catalogo.motos add column empresa_id uuid;

update catalogo.motos
set empresa_id = 'd0000000-0000-4000-8000-000000000001'
where empresa_id is null;

alter table catalogo.motos alter column empresa_id set not null;

drop policy motos_lectura on catalogo.motos;
create policy motos_lectura on catalogo.motos
  for select to authenticated
  using (empresa_id = empresa_actual());
```
(No se agrega política de INSERT/UPDATE porque hoy no existe ninguna —
la Task 12 crea el camino de escritura desde cero; si esa tarea decide
exponer un formulario de alta, la política de `insert`/`update` se agrega
ahí junto con el caso de uso, no aquí, para no adelantar una decisión de
UI que todavía no existe.)

- [ ] **Step 2: Aplicar y verificar**

Run: `pnpm supabase migration up`

```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select count(*) from catalogo.motos where empresa_id is null;"
```
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260730000000_catalogo_empresa_id.sql
git commit -m "feat(catalogo): empresa_id en motos"
```

---

### Task 12: Dominio (nuevo) + contrato + repositorio + servicio — `catalogo`

**Files:**
- Modify: `packages/core/modules/catalogo/domain/moto.ts`
- Modify: `packages/core/modules/catalogo/domain/repository.ts`
- Modify: `packages/core/modules/catalogo/infrastructure/supabase-moto-repository.ts`
- Modify: `packages/core/modules/catalogo/infrastructure/moto-mapper.ts`
- Modify: `packages/core/modules/catalogo/service.ts`
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produces: `Moto.empresaId: string`; `OpcionesBusquedaMotos.empresaId`
  (mediante nuevo parámetro de `buscarMotos`); `CatalogoService
  .buscarMotos(empresaId, opciones)`, `.buscarMotoPorId(empresaId, id)`.

**Nota:** este módulo NO tiene camino de escritura hoy (confirmado: cero
`.insert()` en el repositorio, sin capa `application/`). Este plan
**no** construye una pantalla de alta de motos (fuera de alcance — no lo
pidió Julián); solo agrega `empresaId` a las lecturas y al seed, que es
la única fuente de escritura real hoy.

- [ ] **Step 1: `domain/moto.ts`**

```typescript
export interface Moto {
  id: string;
  empresaId: string;
  nombre: string;
  categoria: string;
  imagen: string;
  precioContadoCentavos: number;
  precioCreditoCentavos: number;
  cilindraje: string;
  potencia: string;
  frenos: string;
  rendimiento: string;
  activo: boolean;
}
```

- [ ] **Step 2: `domain/repository.ts`**

```typescript
export interface OpcionesBusquedaMotos {
  query?: string;
  pagina: number;
  porPagina: number;
}

export interface RepositorioMotos {
  buscar(empresaId: string, opciones: OpcionesBusquedaMotos): Promise<ResultadoPaginado<Moto>>;
  buscarPorId(empresaId: string, id: string): Promise<Moto | null>;
}
```

- [ ] **Step 3: `infrastructure/supabase-moto-repository.ts`**

```typescript
async buscar(empresaId: string, opciones: OpcionesBusquedaMotos): Promise<ResultadoPaginado<Moto>> {
  const pagina = Math.max(1, opciones.pagina);
  const porPagina = Math.max(1, opciones.porPagina);
  const desde = (pagina - 1) * porPagina;
  const hasta = desde + porPagina - 1;

  let consulta = this.supabase
    .schema("catalogo")
    .from("motos")
    .select("*", { count: "exact" })
    .eq("activo", true)
    .eq("empresa_id", empresaId)
    .order("nombre");

  const query = opciones.query?.trim();
  if (query) {
    consulta = consulta.ilike("nombre", `%${query}%`);
  }

  const { data, error, count } = await consulta
    .range(desde, hasta)
    .returns<FilaMoto[]>();
  if (error) throw new Error(`[catalogo] error buscando motos: ${error.message}`);
  return { items: (data ?? []).map(aMoto), total: count ?? 0 };
}

async buscarPorId(empresaId: string, id: string): Promise<Moto | null> {
  const { data, error } = await this.supabase
    .schema("catalogo")
    .from("motos")
    .select()
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .maybeSingle<FilaMoto>();
  if (error) throw new Error(`[catalogo] error buscando moto: ${error.message}`);
  return data ? aMoto(data) : null;
}
```

- [ ] **Step 4: `infrastructure/moto-mapper.ts`**

```typescript
export interface FilaMoto {
  id: string;
  empresa_id: string;
  nombre: string;
  categoria: string;
  imagen: string;
  precio_contado_centavos: number;
  precio_credito_centavos: number;
  cilindraje: string;
  potencia: string;
  frenos: string;
  rendimiento: string;
  activo: boolean;
}
```
`aMoto` gana `empresaId: fila.empresa_id` en la traducción.

- [ ] **Step 5: `service.ts`**

```typescript
export class CatalogoService {
  constructor(private readonly repositorio: RepositorioMotos) {}

  buscarMotos(empresaId: string, opciones: OpcionesBusquedaMotos) {
    return this.repositorio.buscar(empresaId, opciones);
  }

  buscarMotoPorId(empresaId: string, id: string) {
    return this.repositorio.buscarPorId(empresaId, id);
  }
}
```

- [ ] **Step 6: `supabase/seed.sql`**

En la sección "4. Catálogo de motos" (línea ~73-88), agregar
`empresa_id: 'd0000000-0000-4000-8000-000000000001'` a cada uno de los 6
`INSERT` de motos del seed (o, si el seed usa un único `INSERT ... VALUES
(...), (...), ...` multi-fila, agregar la columna `empresa_id` a la lista
de columnas y el valor `'d0000000-0000-4000-8000-000000000001'` a cada
tupla).

- [ ] **Step 7: Typecheck del core**

Run: `pnpm --filter @sumo/core typecheck`
Expected: errores en los ~9 call sites del backoffice y en `flow.e2e.test.ts`
— se resuelven en Task 13.

- [ ] **Step 8: Commit**

```bash
git add packages/core/modules/catalogo/domain/moto.ts \
  packages/core/modules/catalogo/domain/repository.ts \
  packages/core/modules/catalogo/infrastructure/supabase-moto-repository.ts \
  packages/core/modules/catalogo/infrastructure/moto-mapper.ts \
  packages/core/modules/catalogo/service.ts \
  supabase/seed.sql
git commit -m "feat(catalogo): empresaId obligatorio en Moto y CatalogoService"
```

---

### Task 13: Call sites del backoffice + suite de aislamiento — `catalogo`

**Files:**
- Modify: `apps/backoffice/app/(manager)/tienda/page.tsx`
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/page.tsx`
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/nueva/page.tsx`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/page.tsx`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/page.tsx`
- Modify: `apps/backoffice/app/(manager)/hoy/page.tsx`
- Modify: `apps/backoffice/app/(compartido)/clientes/[cedula]/page.tsx`
- Modify: `packages/core/flow.e2e.test.ts`
- Create: `packages/core/aislamiento-catalogo.e2e.test.ts`

**Interfaces:**
- Consumes: `CatalogoService.buscarMotos(empresaId, opciones)`,
  `.buscarMotoPorId(empresaId, id)` (Task 12).

- [ ] **Step 1: `(manager)/tienda/page.tsx`**

```typescript
// antes (dentro del Promise.all condicionado a sesion?.tiendaId)
catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }),
// después
catalogoService().buscarMotos(sesion.empresaId, { pagina: 1, porPagina: 50 }),
```

- [ ] **Step 2: `(vendedor)/solicitudes/page.tsx`**

Mismo diff que Step 1 (misma llamada fija, mismo `Promise.all` condicionado
a `sesion?.tiendaId`, `sesion.empresaId` ya disponible en el scope).

- [ ] **Step 3: `(vendedor)/solicitudes/nueva/page.tsx`**

```typescript
// antes
const motos = await catalogoService().buscarMotos({ query: params.motoQuery, pagina: motoPagina, porPagina: motoPorPagina });
const moto = params.motoId ? await catalogoService().buscarMotoPorId(params.motoId) : null;
// después (sesion.empresaId ya se usa para clientesService en este archivo)
const motos = await catalogoService().buscarMotos(sesion.empresaId, { query: params.motoQuery, pagina: motoPagina, porPagina: motoPorPagina });
const moto = params.motoId ? await catalogoService().buscarMotoPorId(sesion.empresaId, params.motoId) : null;
```

- [ ] **Step 4: `(financiero)/desembolsos/page.tsx`**

```typescript
// antes
const catalogoMotos = await catalogoService().buscarMotos({ pagina: 1, porPagina: 50 });
// después (sesion ya se agregó a este archivo en el plan de reporteria — 2026-07-26)
const catalogoMotos = await catalogoService().buscarMotos(sesion.empresaId, { pagina: 1, porPagina: 50 });
```

- [ ] **Step 5: `(financiero)/desembolsos/[solicitudId]/page.tsx`**

```typescript
// antes
const producto = await originacionService().buscarProducto(sesion.empresaId, par.solicitud.productoId); // ya con empresaId por Task 3
const moto = await catalogoService().buscarMotoPorId(par.solicitud.motoId);
// después
const moto = await catalogoService().buscarMotoPorId(sesion.empresaId, par.solicitud.motoId);
```

- [ ] **Step 6: `(manager)/hoy/page.tsx`**

```typescript
// antes (dentro del Promise.all)
catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }),
// después
catalogoService().buscarMotos(sesion.empresaId, { pagina: 1, porPagina: 50 }),
```

- [ ] **Step 7: `(compartido)/clientes/[cedula]/page.tsx`**

```typescript
// antes
const catalogoMotos = cliente ? await catalogoService().buscarMotos({ pagina: 1, porPagina: 50 }) : { items: [], total: 0 };
// después (sesion.empresaId ya se usa para clientesService en este archivo)
const catalogoMotos = cliente ? await catalogoService().buscarMotos(sesion!.empresaId, { pagina: 1, porPagina: 50 }) : { items: [], total: 0 };
```

- [ ] **Step 8: `flow.e2e.test.ts`**

```typescript
// antes (línea ~49)
const { items: motos } = await catalogo.buscarMotos({ pagina: 1, porPagina: 1 });
// después
const { items: motos } = await catalogo.buscarMotos(EMPRESA, { pagina: 1, porPagina: 1 });
```

- [ ] **Step 9: Typecheck completo**

Run: `pnpm --filter @sumo/core typecheck && pnpm --filter backoffice exec tsc --noEmit`
Expected: cero errores relacionados a `catalogoService()`.

- [ ] **Step 10: Suite de aislamiento**

```typescript
// Aislamiento entre tenants para catalogo — repositorio, sin trigger
// (Grupo 4, empresa_id explícito de la aplicación).
// Se corre manualmente:
// npx vitest run aislamiento-catalogo.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { CatalogoService } from "./modules/catalogo/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const EMPRESA_SUMOTO = "d0000000-0000-4000-8000-000000000001";
const SUFIJO = Date.now().toString(36);

describe("aislamiento entre empresas — catalogo", () => {
  let empresaRival: string;
  let motoRivalId: string;

  beforeAll(async () => {
    arrancarNucleo({ supabase });

    const { data: empresa } = await supabase
      .from("empresas")
      .insert({ nombre: "Rival Catalogo S.A.S.", slug: `rival-catalogo-${SUFIJO}` })
      .select("id")
      .single();
    empresaRival = empresa!.id;

    const { data: moto } = await supabase
      .schema("catalogo")
      .from("motos")
      .insert({
        empresa_id: empresaRival,
        nombre: `Moto Rival ${SUFIJO}`,
        categoria: "urbana",
        imagen: "/placeholder.png",
        precio_contado_centavos: 500_000_000,
        precio_credito_centavos: 550_000_000,
        cilindraje: "150cc",
        potencia: "12hp",
        frenos: "disco",
        rendimiento: "35km/l",
      })
      .select("id")
      .single();
    motoRivalId = moto!.id;
  });

  it("SUMOTO nunca ve la moto de la empresa rival", async () => {
    const catalogo = resolver<CatalogoService>(TOKENS.catalogoService);
    const moto = await catalogo.buscarMotoPorId(EMPRESA_SUMOTO, motoRivalId);
    expect(moto).toBeNull();
  });

  it("la empresa rival SÍ ve su propia moto", async () => {
    const catalogo = resolver<CatalogoService>(TOKENS.catalogoService);
    const moto = await catalogo.buscarMotoPorId(empresaRival, motoRivalId);
    expect(moto).not.toBeNull();
    expect(moto?.nombre).toMatch(/Moto Rival/);
  });
});
```

- [ ] **Step 11: Correr y confirmar**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core exec vitest run aislamiento-catalogo.e2e.test.ts flow.e2e.test.ts --config vitest.e2e.config.ts
```
Expected: ambos archivos PASS.

- [ ] **Step 12: Commit**

```bash
git add "apps/backoffice/app/(manager)/tienda/page.tsx" \
  "apps/backoffice/app/(vendedor)/solicitudes/page.tsx" \
  "apps/backoffice/app/(vendedor)/solicitudes/nueva/page.tsx" \
  "apps/backoffice/app/(financiero)/desembolsos/page.tsx" \
  "apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/page.tsx" \
  "apps/backoffice/app/(manager)/hoy/page.tsx" \
  "apps/backoffice/app/(compartido)/clientes/[cedula]/page.tsx" \
  packages/core/flow.e2e.test.ts \
  packages/core/aislamiento-catalogo.e2e.test.ts
git commit -m "feat(backoffice): empresaId en los 7 call sites de catalogo + suite de aislamiento"
```

---

## Módulo `agenda`

### Task 14: Migración SQL — `agenda`

**Files:**
- Create: `supabase/migrations/20260731000000_agenda_empresa_id.sql`

**Interfaces:**
- Produces: `empresa_id` en `citas` (Grupo 1, vía `tienda_id`, trigger de
  cascada).

- [ ] **Step 1: Escribir la migración**

```sql
-- =============================================================================
-- agenda: empresa_id en citas (Grupo 1, ya tiene tienda_id).
-- =============================================================================

alter table agenda.citas add column empresa_id uuid;

update agenda.citas c
set empresa_id = t.empresa_id
from public.tiendas t
where t.id = c.tienda_id;

create or replace function agenda.derivar_tenencia_cita()
returns trigger as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id from public.tiendas where id = new.tienda_id;
  if v_empresa_id is null then
    raise exception 'tienda_id % no existe en public.tiendas', new.tienda_id;
  end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'empresa_id de cita (%) no coincide con la tienda (%)',
      new.empresa_id, v_empresa_id;
  end if;
  new.empresa_id := v_empresa_id;
  return new;
end;
$$ language plpgsql;

create trigger citas_derivar_tenencia
  before insert on agenda.citas
  for each row execute function agenda.derivar_tenencia_cita();

alter table agenda.citas alter column empresa_id set not null;

drop policy citas_lectura on agenda.citas;
create policy citas_lectura on agenda.citas
  for select to authenticated
  using (
    empresa_id = empresa_actual() and
    (
      rol_actual() = any (array['financiero'::rol_usuario, 'contable'::rol_usuario, 'ceo'::rol_usuario])
      or tienda_id = tienda_actual()
    )
  );

drop policy citas_registro on agenda.citas;
create policy citas_registro on agenda.citas
  for insert to authenticated
  with check (
    rol_actual() = any (array['vendedor'::rol_usuario, 'manager'::rol_usuario])
    and tienda_id = tienda_actual()
  );
```

- [ ] **Step 2: Aplicar y verificar**

Run: `pnpm supabase migration up`

```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "select count(*) from agenda.citas where empresa_id is null;"
```
Expected: `0`.

Control negativo (probar y revertir sin dejar la fila — el INSERT falla,
no hay nada que limpiar):
```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -d postgres -c \
  "insert into agenda.citas (tienda_id, creado_por, titulo, tipo, fecha_hora, empresa_id) select tienda_id, creado_por, titulo, tipo, fecha_hora, gen_random_uuid() from agenda.citas limit 1;"
```
Expected: falla con `empresa_id de cita (...) no coincide con la tienda (...)`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000000_agenda_empresa_id.sql
git commit -m "feat(agenda): empresa_id en citas"
```

---

### Task 15: Dominio + contrato + repositorio + servicio — `agenda`

**Files:**
- Modify: `packages/core/modules/agenda/domain/repository.ts`
- Modify: `packages/core/modules/agenda/infrastructure/supabase-cita-repository.ts`
- Modify: `packages/core/modules/agenda/service.ts`

**Interfaces:**
- Produces: `RepositorioCitas.entre(empresaId, tiendaId, desdeIso, hastaIso)`,
  `.proximas(empresaId, tiendaId, desdeIso, limite)`;
  `AgendaService.citasEntre(empresaId, tiendaId, desdeIso, hastaIso)`,
  `.citasProximas(empresaId, tiendaId, desdeIso, limite?)`.

**Nota:** `domain/cita.ts` (`Cita`/`DatosCita`/`crearCita`) NO se toca —
Grupo 1, el trigger deriva `empresa_id` sin que el dominio lo conozca
(confirmado en la investigación: el escritor no necesita el campo).

- [ ] **Step 1: `domain/repository.ts`**

```typescript
export interface RepositorioCitas {
  guardar(cita: Cita): Promise<Cita>;
  entre(empresaId: string, tiendaId: string, desdeIso: string, hastaIso: string): Promise<Cita[]>;
  proximas(empresaId: string, tiendaId: string, desdeIso: string, limite: number): Promise<Cita[]>;
}
```

- [ ] **Step 2: `infrastructure/supabase-cita-repository.ts`**

```typescript
async entre(empresaId: string, tiendaId: string, desdeIso: string, hastaIso: string): Promise<Cita[]> {
  const { data, error } = await this.supabase
    .schema("agenda")
    .from("citas")
    .select()
    .eq("empresa_id", empresaId)
    .eq("tienda_id", tiendaId)
    .gte("fecha_hora", desdeIso)
    .lt("fecha_hora", hastaIso)
    .order("fecha_hora")
    .returns<FilaCita[]>();
  if (error) throw new Error(`[agenda] error leyendo citas: ${error.message}`);
  return (data ?? []).map(aCita);
}

async proximas(empresaId: string, tiendaId: string, desdeIso: string, limite: number): Promise<Cita[]> {
  const { data, error } = await this.supabase
    .schema("agenda")
    .from("citas")
    .select()
    .eq("empresa_id", empresaId)
    .eq("tienda_id", tiendaId)
    .gte("fecha_hora", desdeIso)
    .order("fecha_hora")
    .limit(limite)
    .returns<FilaCita[]>();
  if (error) throw new Error(`[agenda] error leyendo próximas citas: ${error.message}`);
  return (data ?? []).map(aCita);
}
```
(`guardar` no cambia — Grupo 1, trigger deriva `empresa_id` desde
`tienda_id` en el INSERT.)

- [ ] **Step 3: `service.ts`**

```typescript
citasEntre(empresaId: string, tiendaId: string, desdeIso: string, hastaIso: string) {
  return this.repositorio.entre(empresaId, tiendaId, desdeIso, hastaIso);
}

citasProximas(empresaId: string, tiendaId: string, desdeIso: string, limite = 5) {
  return this.repositorio.proximas(empresaId, tiendaId, desdeIso, limite);
}
```
(`crearCita` no cambia.)

- [ ] **Step 4: Typecheck del core**

Run: `pnpm --filter @sumo/core typecheck`
Expected: errores en `apps/backoffice` (Task 16 los resuelve) — el core en
sí queda limpio.

- [ ] **Step 5: Commit**

```bash
git add packages/core/modules/agenda/domain/repository.ts \
  packages/core/modules/agenda/infrastructure/supabase-cita-repository.ts \
  packages/core/modules/agenda/service.ts
git commit -m "feat(agenda): empresaId obligatorio en RepositorioCitas y AgendaService"
```

---

### Task 16: Call sites del backoffice — `agenda`

**Files:**
- Modify: `apps/backoffice/app/(manager)/hoy/page.tsx`
- Modify: `apps/backoffice/app/(manager)/calendario/page.tsx`
- Modify: `apps/backoffice/components/manager/banner-citas.tsx`
- Modify: `apps/backoffice/app/(manager)/layout.tsx`

**Interfaces:**
- Consumes: `AgendaService.citasEntre(empresaId, tiendaId, ...)`,
  `.citasProximas(empresaId, tiendaId, ...)` (Task 15).

- [ ] **Step 1: `(manager)/hoy/page.tsx`**

```typescript
// antes (dentro del Promise.all)
agendaService().citasEntre(sesion.tiendaId, inicioDia, finDia),
// después
agendaService().citasEntre(sesion.empresaId, sesion.tiendaId, inicioDia, finDia),
```

- [ ] **Step 2: `(manager)/calendario/page.tsx`**

```typescript
// antes
agendaService().citasEntre(
  sesion.tiendaId,
  primerDia.toISOString(),
  primerDiaSiguiente.toISOString(),
),
// después
agendaService().citasEntre(
  sesion.empresaId,
  sesion.tiendaId,
  primerDia.toISOString(),
  primerDiaSiguiente.toISOString(),
),
```

- [ ] **Step 3: `components/manager/banner-citas.tsx`**

```typescript
// antes
export async function BannerCitas({ tiendaId }: { tiendaId: string }) {
  const proximas = await agendaService().citasProximas(tiendaId, ahora.toISOString(), 6);
  ...
}

// después
export async function BannerCitas({ empresaId, tiendaId }: { empresaId: string; tiendaId: string }) {
  const proximas = await agendaService().citasProximas(empresaId, tiendaId, ahora.toISOString(), 6);
  ...
}
```

- [ ] **Step 4: `(manager)/layout.tsx`**

```typescript
// antes
banner={sesion.tiendaId ? <BannerCitas tiendaId={sesion.tiendaId} /> : undefined}
// después
banner={sesion.tiendaId ? <BannerCitas empresaId={sesion.empresaId} tiendaId={sesion.tiendaId} /> : undefined}
```

- [ ] **Step 5: Typecheck completo**

Run: `pnpm --filter @sumo/core typecheck && pnpm --filter backoffice exec tsc --noEmit`
Expected: cero errores en todo el monorepo.

- [ ] **Step 6: Commit**

```bash
git add "apps/backoffice/app/(manager)/hoy/page.tsx" \
  "apps/backoffice/app/(manager)/calendario/page.tsx" \
  apps/backoffice/components/manager/banner-citas.tsx \
  "apps/backoffice/app/(manager)/layout.tsx"
git commit -m "feat(backoffice): empresaId en los 4 call sites de agenda"
```

---

## Task 17: Verificación final

**Files:** ninguno nuevo — solo comandos de verificación y actualización
de `docs/STATUS.md`.

- [ ] **Step 1: Typecheck limpio (core + backoffice)**

Run: `pnpm --filter @sumo/core typecheck && pnpm --filter backoffice exec tsc --noEmit`
Expected: ambos sin output, exit 0.

- [ ] **Step 2: Suite unitaria completa**

Run: `pnpm --filter @sumo/core test`
Expected: todos passing (138 + los fixtures actualizados, sin tests
unitarios nuevos agregados por este plan — solo e2e).

- [ ] **Step 3: Suite e2e completa (9 archivos)**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
export SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core test:e2e
```
Expected: `flow.e2e.test.ts`, `aislamiento-tenant.e2e.test.ts`,
`aislamiento-rls.e2e.test.ts`, `aislamiento-reporteria.e2e.test.ts`,
`aislamiento-originacion.e2e.test.ts`, `aislamiento-cartera.e2e.test.ts`,
`aislamiento-catalogo.e2e.test.ts`, todos pasando.

- [ ] **Step 4: Build de producción**

Run: `pnpm --filter backoffice build`
Expected: exitoso, 24 rutas (sin cambios de superficie — este plan no
agrega ni quita rutas).

- [ ] **Step 5: Recorrido manual mínimo en navegador**

Con `pnpm supabase status` confirmando que corre y `pnpm --filter
backoffice dev` levantado: login como cada uno de los 5 roles de demo
(vendedor, manager, financiero, contable, ceo) y confirmar que las
pantallas que dependían de `originacion`/`cartera`/`contabilidad`/
`catalogo`/`agenda` cargan sin error 500 — especialmente `/solicitudes/nueva`
(vendedor, cruza originacion+catalogo+clientes), `/desembolsos/[id]`
(financiero, cruza originacion+cartera+catalogo), `/hoy` y `/calendario`
(manager, cruza agenda+reporteria+catalogo).

- [ ] **Step 6: Actualizar `docs/STATUS.md`**

Agregar entrada de bitácora fechada resumiendo: `empresa_id`/`tienda_id`
en las 13 tablas de `originacion`, `cartera`+`links`, `contabilidad`,
`catalogo`, `agenda`; 10 triggers de cascada con validación (incluyendo 2
casos de doble padre); gap de `asientos_recientes` de la spec de
`reporteria` cerrado; 3 suites nuevas de aislamiento
(`aislamiento-originacion`, `aislamiento-cartera`, `aislamiento-catalogo`)
con control negativo de trigger verificado. Marcar la Fase 2 de
multi-tenencia como COMPLETA — con la salvedad de que "regional" (nivel
intermedio entre empresa y tienda) quedó explícitamente fuera de alcance
por decisión de Julián.

- [ ] **Step 7: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): fase 2 de multi-tenencia completa — 5 módulos, 13 tablas, triggers de cascada"
```

## Self-Review

**Cobertura de la spec:** secciones 2 (clasificación de tablas) cubierta
por las Tasks 1/5/9/11/14 (migraciones); sección 3 (mecanismo de trigger)
cubierta en las 5 migraciones con el patrón validar-y-rechazar en los 10
triggers (incluyendo los 2 casos de doble padre en Tasks 5); sección 4
(RLS) cubierta en cada migración; sección 5 (cambios de aplicación)
cubierta en Tasks 2/6/7/9/12/15; sección 6 (testing, 3 capas) cubierta en
Tasks 4/8/10/13 — la suite de aislamiento RLS (capa 2 de la spec, patrón
`aislamiento-rls.e2e.test.ts`) se dejó fuera de las suites nuevas de este
plan por alcance práctico (ya está cubierta a nivel `clientes` desde la
fase 1, y las 13 tablas nuevas heredan las mismas funciones RLS
`empresa_actual()`/`tienda_actual()` ya probadas ahí) — si Julián quiere
una suite RLS dedicada por módulo, es un plan de seguimiento pequeño, no
bloquea esta fase.

**Placeholders:** ninguno en SQL (las 5 migraciones traen el `CREATE
TRIGGER`/`ALTER TABLE`/política completos). Algunos pasos de TS marcan
explícitamente "verificar contra el código real antes de aplicar" cuando
el contenido exacto de un archivo no fue leído carácter por carácter en
la investigación (ej. `politicas/page.tsx` tras los cambios de sliders,
`module.ts` de contabilidad) — esto es intencional y está señalado como
tal, no es un placeholder de lo que hay que HACER, solo de la ubicación
exacta dentro de un archivo ya descrito con su diff completo.

**Consistencia de tipos:** `empresaId: string` como primer parámetro en
TODOS los métodos de lectura de los 5 módulos, verificado método por
método contra las firmas reales investigadas. Para Grupo 4
(`productos_credito`, `motos`), `empresaId` vive DENTRO del tipo de
escritura (`DatosProducto`, no un parámetro de `guardar`) — consistente
en Tasks 2 y 12. La cadena cross-módulo `paraDesembolso` mantiene
`empresaId` como primer parámetro en las 3 capas que atraviesa
(`FuenteSolicitudesAprobadas` → `DesembolsarSolicitudAprobada` →
`OriginacionService`).
