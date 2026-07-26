# `reporteria` con `empresa_id` — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar la fuga de datos entre empresas-cliente en el módulo
`reporteria` (encontrada por el review final de la fase 1 de
multi-tenencia): 8 de sus 9 vistas/métodos exponen datos de cartera y
solicitudes sin acotar por `empresa_id`, corriendo en `service_role`
(bypassa RLS).

**Architecture:** ver
`docs/superpowers/specs/2026-07-26-reporteria-empresa-id-design.md`. Las
8 vistas ganan una columna `empresa_id` (vía join a `public.tiendas`, que
ya la tiene desde la fase 1); `ReporteriaService` filtra explícitamente
por ella en cada método (mismo patrón de dos puertas que `clientes`,
excepto que aquí la RLS real de las tablas de origen todavía no conoce
`empresa_id` — ver limitación en la spec sección 3, y NO fingir esa
protección en el test de este plan).

**Tech Stack:** Supabase (Postgres, vistas `security_invoker`),
TypeScript estricto, vitest, Next.js 16 App Router.

## Alcance

**Dentro:** 8 vistas (`cartera_por_credito`, `mora_por_franja`,
`resumen_cartera`, `recaudo_mensual`, `cartera_por_tienda`,
`solicitudes_recientes`, `desempeno_vendedores`, `colocacion_diaria`);
los 8 métodos correspondientes de `ReporteriaService`; los 10 archivos
del backoffice que los consumen (verificado uno por uno contra el código
real — 2 archivos que solo llaman `asientosRecientes` quedan sin tocar).

**Fuera:** `asientos_recientes` — gap documentado, se cierra con la fase
2 de `cartera`+`contabilidad` (ver spec sección 1). `(contable)/
contabilidad/page.tsx` y `(contable)/contabilidad/exportar/route.ts` NO
se tocan en este plan (solo consumen `asientosRecientes`).

## Global Constraints

- Dinero SIEMPRE en centavos enteros, nunca float.
- TypeScript estricto, sin `any` sin justificar.
- `empresaId` SIEMPRE como PRIMER parámetro, SIEMPRE obligatorio (nunca
  opcional) en los 8 métodos de `ReporteriaService` — cruzar el límite de
  empresa nunca es legítimo, a diferencia de `tiendaId` que sí puede ser
  opcional para roles de alcance nacional.
- Toda mutación de esquema es una migración versionada, nunca
  configuración manual en Studio.
- `psql` no está en PATH directo — usar
  `docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -c "..."`.
- Local Supabase ya corre — no reinstalar ni reiniciar salvo que
  `pnpm supabase status` muestre que está caído.
- Para verificar el typecheck real del core:
  `pnpm --filter @sumo/core typecheck` (o `pnpm typecheck` desde la raíz,
  ya wireado). Para el backoffice: `pnpm --filter backoffice exec tsc --noEmit`
  (más rápido que `build` para iterar; correr `build` una vez al final).
- Para tests e2e, exportar las llaves:
  `export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)`
- Commits: excepción confirmada por Julián — en esta ejecución
  subagent-driven, cada tarea SÍ termina con `git commit` real. Si el
  entorno de ejecución NO es un worktree aislado (verificar con
  `git branch --show-current` antes del primer comando git de cada
  tarea), es porque el controller decidió trabajar directo en `main` —
  de cualquier modo, cada comando de un subagente debe empezar con
  `cd <ruta exacta del checkout activo> &&`, nunca asumir el directorio.

---

### Task 1: Migración — `empresa_id` en las 8 vistas

**Files:**
- Create: `supabase/migrations/20260726000000_reporteria_empresa_id.sql`

**Interfaces:**
- Produces: columna `empresa_id` (uuid) expuesta en las 8 vistas listadas
  arriba. La Tarea 2 la consume vía `.eq("empresa_id", empresaId)`.

- [ ] **Step 1: Escribir la migración**

Las definiciones ACTUALES de las 8 vistas (verificadas contra la base
real con `pg_get_viewdef`, no reconstruidas a mano desde migraciones
viejas) y su versión nueva:

```sql
-- =============================================================================
-- reporteria: empresa_id en las 8 vistas con camino a public.tiendas.
-- asientos_recientes queda FUERA (gap documentado, se cierra con la fase 2
-- de cartera+contabilidad — ver spec 2026-07-26-reporteria-empresa-id-design.md).
-- =============================================================================

create or replace view reporteria.cartera_por_credito
  with (security_invoker = true) as
select
  c.id as credito_id,
  c.cliente_id,
  c.tienda_id,
  t.empresa_id,
  c.desembolsado_en,
  c.cuota_centavos,
  c.monto_desembolsado_centavos,
  sum(q.capital_centavos - q.capital_pagado_centavos)::bigint
    as capital_pendiente_centavos,
  coalesce(
    max(current_date - q.fecha_vencimiento) filter (
      where q.fecha_vencimiento < current_date
        and (q.capital_centavos - q.capital_pagado_centavos
           + q.interes_centavos - q.interes_pagado_centavos) > 0
    ),
    0
  ) as dias_mora,
  case
    when coalesce(
      max(current_date - q.fecha_vencimiento) filter (
        where q.fecha_vencimiento < current_date
          and (q.capital_centavos - q.capital_pagado_centavos
             + q.interes_centavos - q.interes_pagado_centavos) > 0
      ), 0) <= 30 then '0-30'
    when coalesce(
      max(current_date - q.fecha_vencimiento) filter (
        where q.fecha_vencimiento < current_date
          and (q.capital_centavos - q.capital_pagado_centavos
             + q.interes_centavos - q.interes_pagado_centavos) > 0
      ), 0) <= 60 then '31-60'
    when coalesce(
      max(current_date - q.fecha_vencimiento) filter (
        where q.fecha_vencimiento < current_date
          and (q.capital_centavos - q.capital_pagado_centavos
             + q.interes_centavos - q.interes_pagado_centavos) > 0
      ), 0) <= 90 then '61-90'
    else '90+'
  end as franja_mora
from cartera.creditos c
join cartera.cuotas q on q.credito_id = c.id
join public.tiendas t on t.id = c.tienda_id
where c.estado = 'activo'
group by c.id, t.empresa_id;

create or replace view reporteria.mora_por_franja
  with (security_invoker = true) as
select
  empresa_id,
  franja_mora,
  count(*) as creditos,
  sum(capital_pendiente_centavos)::bigint as capital_pendiente_centavos
from reporteria.cartera_por_credito
group by empresa_id, franja_mora;

create or replace view reporteria.resumen_cartera
  with (security_invoker = true) as
select
  empresa_id,
  count(*) as creditos_activos,
  coalesce(sum(capital_pendiente_centavos), 0)::bigint
    as cartera_total_centavos,
  coalesce(sum(capital_pendiente_centavos) filter (where dias_mora > 0), 0)::bigint
    as cartera_vencida_centavos,
  round(
    coalesce(sum(capital_pendiente_centavos) filter (where dias_mora > 0), 0)::numeric
      / nullif(sum(capital_pendiente_centavos), 0),
    4
  ) as icv
from reporteria.cartera_por_credito
group by empresa_id;

create or replace view reporteria.recaudo_mensual
  with (security_invoker = true) as
select
  t.empresa_id,
  date_trunc('month', p.fecha_pago)::date as mes,
  count(distinct p.id) as pagos,
  sum(p.monto_centavos)::bigint as recaudo_centavos,
  coalesce(sum(a.monto_centavos) filter (where a.componente = 'mora'), 0)::bigint
    as mora_centavos,
  coalesce(sum(a.monto_centavos) filter (where a.componente = 'interes'), 0)::bigint
    as interes_centavos,
  coalesce(sum(a.monto_centavos) filter (where a.componente = 'capital'), 0)::bigint
    as capital_centavos
from cartera.pagos p
join cartera.creditos c on c.id = p.credito_id
join public.tiendas t on t.id = c.tienda_id
left join cartera.aplicaciones_pago a on a.pago_id = p.id
group by t.empresa_id, date_trunc('month', p.fecha_pago)
order by date_trunc('month', p.fecha_pago);

create or replace view reporteria.cartera_por_tienda
  with (security_invoker = true) as
select
  t.id as tienda_id,
  t.empresa_id,
  t.nombre as tienda_nombre,
  count(cc.credito_id) as creditos_activos,
  coalesce(sum(cc.capital_pendiente_centavos), 0)::bigint as capital_total_centavos,
  coalesce(sum(cc.capital_pendiente_centavos) filter (where cc.dias_mora > 0), 0)::bigint
    as capital_vencido_centavos,
  t.meta_colocacion_centavos
from public.tiendas t
left join reporteria.cartera_por_credito cc on cc.tienda_id = t.id
group by t.id, t.empresa_id, t.nombre, t.meta_colocacion_centavos;

create or replace view reporteria.solicitudes_recientes
  with (security_invoker = true) as
select
  s.id as solicitud_id,
  s.tienda_id,
  t.empresa_id,
  s.creado_en,
  s.valor_moto_centavos,
  s.estado,
  cl.nombres || ' ' || cl.apellidos as cliente_nombre,
  d.resultado as decision_resultado,
  d.cuota_estimada_centavos,
  cl.cedula as cliente_cedula,
  cl.telefono as cliente_telefono,
  s.plazo_meses,
  s.creado_por,
  m.nombre as moto_nombre,
  p.nombre as vendedor_nombre,
  left(s.id::text, 8) as solicitud_corta
from originacion.solicitudes s
join public.tiendas t on t.id = s.tienda_id
left join clientes.clientes cl on cl.id = s.cliente_id
left join catalogo.motos m on m.id = s.moto_id
left join public.perfiles p on p.user_id = s.creado_por
left join lateral (
  select resultado, cuota_estimada_centavos
  from originacion.decisiones
  where solicitud_id = s.id
  order by evaluado_en desc
  limit 1
) d on true
order by s.creado_en desc;

create or replace view reporteria.desempeno_vendedores
  with (security_invoker = true) as
select
  s.tienda_id,
  t.empresa_id,
  s.creado_por,
  p.nombre as vendedor_nombre,
  count(*)::int as solicitudes,
  count(*) filter (where d.resultado = 'APROBADO')::int as aprobadas,
  coalesce(sum(cr.monto_desembolsado_centavos), 0)::bigint as colocacion_centavos
from originacion.solicitudes s
join public.tiendas t on t.id = s.tienda_id
join public.perfiles p on p.user_id = s.creado_por
left join lateral (
  select resultado from originacion.decisiones
  where solicitud_id = s.id
  order by evaluado_en desc
  limit 1
) d on true
left join links.solicitud_credito lk on lk.solicitud_id = s.id
left join cartera.creditos cr on cr.id = lk.credito_id
group by s.tienda_id, t.empresa_id, s.creado_por, p.nombre;

create or replace view reporteria.colocacion_diaria
  with (security_invoker = true) as
select
  c.tienda_id,
  t.empresa_id,
  c.desembolsado_en as fecha,
  count(*)::int as creditos,
  sum(c.monto_desembolsado_centavos)::bigint as monto_centavos
from cartera.creditos c
join public.tiendas t on t.id = c.tienda_id
group by c.tienda_id, t.empresa_id, c.desembolsado_en;
```

- [ ] **Step 2: Aplicar y verificar**

Run: `pnpm supabase db reset`
Expected: sin errores. Luego verificar que las 8 vistas exponen la
columna:
```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -c \
  "select table_name from information_schema.columns where table_schema = 'reporteria' and column_name = 'empresa_id' order by table_name;"
```
Expected: 8 filas (las 8 vistas de este plan, NO `asientos_recientes`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260726000000_reporteria_empresa_id.sql
git commit -m "feat(reporteria): empresa_id en 8 vistas (cartera, solicitudes, desempeño)"
```

---

### Task 2: `ReporteriaService` — `empresaId` obligatorio en 8 métodos

**Files:**
- Modify: `packages/core/modules/reporteria/service.ts`

**Interfaces:**
- Consumes: columna `empresa_id` de las 8 vistas (Tarea 1).
- Produces: firmas `resumenCartera(empresaId)`, `moraPorFranja(empresaId)`,
  `recaudoMensual(empresaId, opciones?)`, `carteraPorTienda(empresaId,
  opciones?)`, `solicitudesRecientes(empresaId, opciones?)`,
  `solicitudesPaginadas(empresaId, opciones)`, `desempenoVendedores(
  empresaId, tiendaId)`, `colocacionDiaria(empresaId, tiendaId, desde?,
  hasta?)` — las Tareas 3-5 (call sites) las consumen. `asientosRecientes`
  NO se toca.

- [ ] **Step 1: `resumenCartera` y `moraPorFranja`**

```typescript
  async resumenCartera(empresaId: string): Promise<ResumenCartera> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("resumen_cartera")
      .select()
      .eq("empresa_id", empresaId)
      .single<ResumenCartera>();
    if (error)
      throw new Error(`[reporteria] error leyendo resumen: ${error.message}`);
    return data;
  }

  async moraPorFranja(empresaId: string): Promise<MoraPorFranja[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("mora_por_franja")
      .select()
      .eq("empresa_id", empresaId)
      .returns<MoraPorFranja[]>();
    if (error)
      throw new Error(`[reporteria] error leyendo mora: ${error.message}`);
    return data ?? [];
  }
```

- [ ] **Step 2: `recaudoMensual`**

El bloque `let consulta: ConsultaVista = aplicarFiltros(...)` pasa de:

```typescript
  async recaudoMensual(opciones?: {
    limite?: number;
    query?: string;
    orden?: string;
    direccion?: "asc" | "desc";
    filtros?: FiltrosRecaudoMensual;
  }): Promise<RecaudoMensual[]> {
    const limite = opciones?.limite ?? 6;
    const ordenValido =
      opciones?.orden !== undefined && COLUMNAS_RECAUDO.has(opciones.orden);
    const orden = ordenValido ? opciones!.orden! : "mes";
    const ascendente = ordenValido && opciones?.direccion === "asc";

    let consulta: ConsultaVista = aplicarFiltros(
      this.supabase.schema("reporteria").from("recaudo_mensual").select(),
      MAPA_FILTROS_RECAUDO,
      opciones?.filtros,
    );
```

a:

```typescript
  async recaudoMensual(
    empresaId: string,
    opciones?: {
      limite?: number;
      query?: string;
      orden?: string;
      direccion?: "asc" | "desc";
      filtros?: FiltrosRecaudoMensual;
    },
  ): Promise<RecaudoMensual[]> {
    const limite = opciones?.limite ?? 6;
    const ordenValido =
      opciones?.orden !== undefined && COLUMNAS_RECAUDO.has(opciones.orden);
    const orden = ordenValido ? opciones!.orden! : "mes";
    const ascendente = ordenValido && opciones?.direccion === "asc";

    let consulta: ConsultaVista = aplicarFiltros(
      this.supabase
        .schema("reporteria")
        .from("recaudo_mensual")
        .select()
        .eq("empresa_id", empresaId),
      MAPA_FILTROS_RECAUDO,
      opciones?.filtros,
    );
```

(el resto del método, desde `const termino = ...` hasta el final, no cambia).

- [ ] **Step 3: `carteraPorTienda`**

Mismo patrón que el Step 2:

```typescript
  async carteraPorTienda(
    empresaId: string,
    opciones?: {
      query?: string;
      orden?: string;
      direccion?: "asc" | "desc";
      filtros?: FiltrosCarteraTienda;
    },
  ): Promise<CarteraPorTienda[]> {
    const ordenValido =
      opciones?.orden !== undefined &&
      COLUMNAS_CARTERA_TIENDA.has(opciones.orden);
    const orden = ordenValido ? opciones!.orden! : "capital_total_centavos";
    const ascendente = ordenValido && opciones?.direccion === "asc";

    let consulta: ConsultaVista = aplicarFiltros(
      this.supabase
        .schema("reporteria")
        .from("cartera_por_tienda")
        .select()
        .eq("empresa_id", empresaId),
      MAPA_FILTROS_CARTERA_TIENDA,
      opciones?.filtros,
    );
```

(el resto del método no cambia).

- [ ] **Step 4: `solicitudesRecientes`**

```typescript
  async solicitudesRecientes(
    empresaId: string,
    opciones: { tiendaId?: string; limite?: number } = {},
  ): Promise<SolicitudReciente[]> {
    let consulta = this.supabase
      .schema("reporteria")
      .from("solicitudes_recientes")
      .select()
      .eq("empresa_id", empresaId)
      .order("creado_en", { ascending: false })
      .limit(opciones.limite ?? 20);
    if (opciones.tiendaId) {
      consulta = consulta.eq("tienda_id", opciones.tiendaId);
    }
    const { data, error } = await consulta.returns<SolicitudReciente[]>();
    if (error)
      throw new Error(
        `[reporteria] error leyendo solicitudes recientes: ${error.message}`,
      );
    return data ?? [];
  }
```

- [ ] **Step 5: `solicitudesPaginadas`**

El inicio del método pasa de:

```typescript
  async solicitudesPaginadas(opciones: {
    tiendaId?: string;
    creadoPor?: string;
    clienteCedula?: string;
    query?: string;
    filtros?: FiltrosSolicitudes;
    desdeFecha?: string;
    hastaFecha?: string;
    orden?: string;
    direccion?: "asc" | "desc";
    pagina: number;
    porPagina: number;
  }): Promise<PaginaSolicitudes> {
    const pagina = Math.max(1, opciones.pagina);
    const porPagina = Math.max(1, opciones.porPagina);
    const desde = (pagina - 1) * porPagina;

    const ordenValido =
      opciones.orden !== undefined && COLUMNAS_ORDENABLES.has(opciones.orden);
    const orden = ordenValido ? opciones.orden! : "creado_en";
    const ascendente = ordenValido && opciones.direccion === "asc";

    let consulta: ConsultaVista = this.supabase
      .schema("reporteria")
      .from("solicitudes_recientes")
      .select("*", { count: "exact" })
      .order(orden, { ascending: ascendente })
      .order("solicitud_id", { ascending: true });
```

a:

```typescript
  async solicitudesPaginadas(
    empresaId: string,
    opciones: {
      tiendaId?: string;
      creadoPor?: string;
      clienteCedula?: string;
      query?: string;
      filtros?: FiltrosSolicitudes;
      desdeFecha?: string;
      hastaFecha?: string;
      orden?: string;
      direccion?: "asc" | "desc";
      pagina: number;
      porPagina: number;
    },
  ): Promise<PaginaSolicitudes> {
    const pagina = Math.max(1, opciones.pagina);
    const porPagina = Math.max(1, opciones.porPagina);
    const desde = (pagina - 1) * porPagina;

    const ordenValido =
      opciones.orden !== undefined && COLUMNAS_ORDENABLES.has(opciones.orden);
    const orden = ordenValido ? opciones.orden! : "creado_en";
    const ascendente = ordenValido && opciones.direccion === "asc";

    let consulta: ConsultaVista = this.supabase
      .schema("reporteria")
      .from("solicitudes_recientes")
      .select("*", { count: "exact" })
      .eq("empresa_id", empresaId)
      .order(orden, { ascending: ascendente })
      .order("solicitud_id", { ascending: true });
```

(el resto del método, desde `if (opciones.tiendaId)` hasta el final, no cambia).

- [ ] **Step 6: `desempenoVendedores` y `colocacionDiaria`**

```typescript
  async desempenoVendedores(
    empresaId: string,
    tiendaId: string,
  ): Promise<DesempenoVendedor[]> {
    const { data, error } = await this.supabase
      .schema("reporteria")
      .from("desempeno_vendedores")
      .select()
      .eq("empresa_id", empresaId)
      .eq("tienda_id", tiendaId)
      .order("colocacion_centavos", { ascending: false })
      .returns<DesempenoVendedor[]>();
    if (error)
      throw new Error(`[reporteria] error leyendo desempeño: ${error.message}`);
    return data ?? [];
  }

  async colocacionDiaria(
    empresaId: string,
    tiendaId: string,
    desdeIso?: string,
    hastaIso?: string,
  ): Promise<ColocacionDia[]> {
    let consulta = this.supabase
      .schema("reporteria")
      .from("colocacion_diaria")
      .select()
      .eq("empresa_id", empresaId)
      .eq("tienda_id", tiendaId)
      .order("fecha");
    if (desdeIso) consulta = consulta.gte("fecha", desdeIso);
    if (hastaIso) consulta = consulta.lt("fecha", hastaIso);
    const { data, error } = await consulta.returns<ColocacionDia[]>();
    if (error)
      throw new Error(
        `[reporteria] error leyendo colocación: ${error.message}`,
      );
    return data ?? [];
  }
```

- [ ] **Step 7: Typecheck (a propósito, DEBE fallar en el backoffice)**

Run: `pnpm --filter @sumo/core typecheck`
Expected: limpio (el core mismo no llama a estos métodos, solo los define).

Run: `pnpm --filter backoffice exec tsc --noEmit`
Expected: **errores** en los 10 archivos que llaman `reporteriaService()`
sin el nuevo primer argumento — esto es correcto y esperado en este
punto. Las Tareas 3-5 los arreglan. Anotar en el reporte cuántos errores
aparecen (debería rondar 10-15, uno o más por archivo según cuántos
métodos llama cada uno) para que la Tarea 5 pueda confirmar que llegaron
a cero.

- [ ] **Step 8: Commit**

```bash
git add packages/core/modules/reporteria/service.ts
git commit -m "feat(reporteria): empresaId obligatorio en 8 métodos de ReporteriaService"
```

---

### Task 3: Call sites — área manager (`hoy`, `tienda`, `calendario`)

**Files:**
- Modify: `apps/backoffice/app/(manager)/hoy/page.tsx`
- Modify: `apps/backoffice/app/(manager)/tienda/page.tsx`
- Modify: `apps/backoffice/app/(manager)/calendario/page.tsx`

**Interfaces:**
- Consumes: los 8 métodos con `empresaId` de la Tarea 2; `Sesion.empresaId`
  (ya existe desde fase 1, `Sesion extends Perfil`).

- [ ] **Step 1: `(manager)/hoy/page.tsx`**

Las 3 líneas dentro del `Promise.all` (dentro del bloque `sesion?.tiendaId
? ... : ...`, donde `sesion` ya está narrowed a no-nulo):

```typescript
        reporteriaService().colocacionDiaria(sesion.tiendaId, hoyIso, mananaIso),
        reporteriaService().desempenoVendedores(sesion.tiendaId),
```

pasan a:

```typescript
        reporteriaService().colocacionDiaria(sesion.empresaId, sesion.tiendaId, hoyIso, mananaIso),
        reporteriaService().desempenoVendedores(sesion.empresaId, sesion.tiendaId),
```

y:

```typescript
        reporteriaService().carteraPorTienda(),
```

pasa a:

```typescript
        reporteriaService().carteraPorTienda(sesion.empresaId),
```

Más abajo, el bloque de `solicitudesPaginadas`:

```typescript
    ? await reporteriaService().solicitudesPaginadas({
        tiendaId: sesion.tiendaId,
```

pasa a:

```typescript
    ? await reporteriaService().solicitudesPaginadas(sesion.empresaId, {
        tiendaId: sesion.tiendaId,
```

- [ ] **Step 2: `(manager)/tienda/page.tsx`**

Dentro del `Promise.all` (bloque `sesion?.tiendaId ? ... : ...`):

```typescript
        svc.carteraPorTienda(),
        svc.desempenoVendedores(sesion.tiendaId),
        svc.colocacionDiaria(sesion.tiendaId, desde),
```

pasa a:

```typescript
        svc.carteraPorTienda(sesion.empresaId),
        svc.desempenoVendedores(sesion.empresaId, sesion.tiendaId),
        svc.colocacionDiaria(sesion.empresaId, sesion.tiendaId, desde),
```

Y el bloque de `solicitudesPaginadas`:

```typescript
    ? await svc.solicitudesPaginadas({
        tiendaId: sesion.tiendaId,
```

pasa a:

```typescript
    ? await svc.solicitudesPaginadas(sesion.empresaId, {
        tiendaId: sesion.tiendaId,
```

- [ ] **Step 3: `(manager)/calendario/page.tsx`**

```typescript
        reporteriaService().colocacionDiaria(
          sesion.tiendaId,
          claveDia(primerDia),
          claveDia(primerDiaSiguiente),
        ),
```

pasa a:

```typescript
        reporteriaService().colocacionDiaria(
          sesion.empresaId,
          sesion.tiendaId,
          claveDia(primerDia),
          claveDia(primerDiaSiguiente),
        ),
```

- [ ] **Step 4: Typecheck parcial**

Run: `pnpm --filter backoffice exec tsc --noEmit`
Expected: los errores de estos 3 archivos desaparecen; los de las Tareas
4-5 (todavía no tocados) siguen presentes — esperado en este punto.

- [ ] **Step 5: Commit**

```bash
git add "apps/backoffice/app/(manager)/hoy/page.tsx" "apps/backoffice/app/(manager)/tienda/page.tsx" "apps/backoffice/app/(manager)/calendario/page.tsx"
git commit -m "feat(backoffice): empresaId en reporteria — área manager (hoy, tienda, calendario)"
```

---

### Task 4: Call sites — vendedor y compartido

**Files:**
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/page.tsx`
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/exportar/route.ts`
- Modify: `apps/backoffice/app/(compartido)/clientes/[cedula]/page.tsx`

**Interfaces:**
- Consumes: `solicitudesPaginadas(empresaId, opciones)` (Tarea 2).

- [ ] **Step 1: `(vendedor)/solicitudes/page.tsx`**

```typescript
    ? await reporteriaService().solicitudesPaginadas({
        ...(sesion.rol === "vendedor"
```

pasa a:

```typescript
    ? await reporteriaService().solicitudesPaginadas(sesion.empresaId, {
        ...(sesion.rol === "vendedor"
```

(está dentro del bloque `sesion?.tiendaId ? ... : ...`, `sesion.empresaId`
seguro por la misma narrowing que ya usa `sesion.tiendaId`/`sesion.rol`
ahí mismo).

- [ ] **Step 2: `(vendedor)/solicitudes/exportar/route.ts`**

```typescript
  const { items } = await reporteriaService().solicitudesPaginadas({
    ...(sesion.rol === "vendedor"
```

pasa a:

```typescript
  const { items } = await reporteriaService().solicitudesPaginadas(sesion.empresaId, {
    ...(sesion.rol === "vendedor"
```

(`sesion` viene de `exigirRol([...])`, ya no-nulo por el `if (sesion
instanceof Response) return sesion;` de arriba).

- [ ] **Step 3: `(compartido)/clientes/[cedula]/page.tsx`**

```typescript
    ? await reporteriaService().solicitudesPaginadas({
        clienteCedula: cliente.cedula,
```

pasa a:

```typescript
    ? await reporteriaService().solicitudesPaginadas(sesion!.empresaId, {
        clienteCedula: cliente.cedula,
```

(usa `sesion!` con non-null assertion porque `cliente` truthy implica que
`sesion` fue truthy cuando se resolvió `clienteCrudo` más arriba —
TypeScript no conecta esa relación automáticamente entre las dos
expresiones, y el archivo YA usa el mismo patrón `sesion!.tiendaId!` unas
líneas más abajo del punto donde se inserta este cambio — seguir ese
precedente exacto, no inventar uno nuevo).

- [ ] **Step 4: Typecheck parcial**

Run: `pnpm --filter backoffice exec tsc --noEmit`
Expected: los errores de estos 3 archivos desaparecen; los de la Tarea 5
siguen presentes.

- [ ] **Step 5: Commit**

```bash
git add "apps/backoffice/app/(vendedor)/solicitudes/page.tsx" "apps/backoffice/app/(vendedor)/solicitudes/exportar/route.ts" "apps/backoffice/app/(compartido)/clientes/[cedula]/page.tsx"
git commit -m "feat(backoffice): empresaId en reporteria — vendedor y compartido"
```

---

### Task 5: Call sites — financiero y ceo (3 páginas ganan sesión nueva)

**Files:**
- Modify: `apps/backoffice/app/(financiero)/cartera/page.tsx`
- Modify: `apps/backoffice/app/(financiero)/cartera/exportar-recaudo/route.ts`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/page.tsx`
- Modify: `apps/backoffice/app/(ceo)/ceo/page.tsx`

**Interfaces:**
- Consumes: `resumenCartera(empresaId)`, `moraPorFranja(empresaId)`,
  `recaudoMensual(empresaId, opciones?)`, `carteraPorTienda(empresaId,
  opciones?)`, `solicitudesPaginadas(empresaId, opciones)` (Tarea 2).

**Nota de riesgo:** 3 de estos 4 archivos (`cartera/page.tsx`,
`desembolsos/page.tsx`, `ceo/page.tsx`) HOY no resuelven ninguna sesión
— dependen 100% de que el layout del route group ya los proteja por rol.
Hay que AGREGAR `obtenerSesion()` — es código nuevo, no un cambio
mecánico, mismo patrón ya usado en la fase 1 para
`desembolsos/[solicitudId]/page.tsx`.

- [ ] **Step 1: `(financiero)/cartera/page.tsx` — agregar sesión**

Agregar el import (junto a los demás imports de `@/lib/...`):

```typescript
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
```

Dentro de `DashboardCartera`, ANTES de `const tableQuery = ...`:

```typescript
  const sesion = await obtenerSesion();
  if (!sesion) notFound();
```

Luego el bloque:

```typescript
  const [resumen, porFranja, recaudo, pendientes] = await Promise.all([
    svc.resumenCartera(),
    svc.moraPorFranja(),
    svc.recaudoMensual({ query: params.recQuery, ...tableQuery }),
    svc.solicitudesPaginadas({
      filtros: { decision: "APROBADO", estado: "evaluada" },
      pagina: 1,
      porPagina: 1,
    }),
  ]);
```

pasa a:

```typescript
  const [resumen, porFranja, recaudo, pendientes] = await Promise.all([
    svc.resumenCartera(sesion.empresaId),
    svc.moraPorFranja(sesion.empresaId),
    svc.recaudoMensual(sesion.empresaId, { query: params.recQuery, ...tableQuery }),
    svc.solicitudesPaginadas(sesion.empresaId, {
      filtros: { decision: "APROBADO", estado: "evaluada" },
      pagina: 1,
      porPagina: 1,
    }),
  ]);
```

- [ ] **Step 2: `(financiero)/cartera/exportar-recaudo/route.ts`**

```typescript
  const recaudo = await reporteriaService().recaudoMensual({
    query: params.recQuery,
```

pasa a:

```typescript
  const recaudo = await reporteriaService().recaudoMensual(sesion.empresaId, {
    query: params.recQuery,
```

(`sesion` ya viene de `exigirRol(["financiero"])`, no-nulo).

- [ ] **Step 3: `(financiero)/desembolsos/page.tsx` — agregar sesión**

Agregar el import:

```typescript
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
```

Dentro de `DesembolsosPage`, ANTES de `const catalogoMotos = ...`:

```typescript
  const sesion = await obtenerSesion();
  if (!sesion) notFound();
```

Luego:

```typescript
  const pendientes = await reporteriaService().solicitudesPaginadas({
    query: params.desQuery,
```

pasa a:

```typescript
  const pendientes = await reporteriaService().solicitudesPaginadas(sesion.empresaId, {
    query: params.desQuery,
```

- [ ] **Step 4: `(ceo)/ceo/page.tsx` — agregar sesión**

Agregar el import:

```typescript
import { notFound } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
```

Dentro de `CeoPage`, ANTES de `const tableQuery = ...`:

```typescript
  const sesion = await obtenerSesion();
  if (!sesion) notFound();
```

Luego:

```typescript
  const svc = reporteriaService();
  const [resumen, porTienda, recaudo] = await Promise.all([
    svc.resumenCartera(),
    svc.carteraPorTienda({ query: params.tiendaQuery, ...tableQuery }),
    svc.recaudoMensual(),
  ]);
```

pasa a:

```typescript
  const svc = reporteriaService();
  const [resumen, porTienda, recaudo] = await Promise.all([
    svc.resumenCartera(sesion.empresaId),
    svc.carteraPorTienda(sesion.empresaId, { query: params.tiendaQuery, ...tableQuery }),
    svc.recaudoMensual(sesion.empresaId),
  ]);
```

- [ ] **Step 5: Typecheck completo (debe llegar a cero)**

Run: `pnpm --filter backoffice exec tsc --noEmit`
Expected: **cero errores** — con esto se cierran los ~10-15 que abrió la
Tarea 2, Step 7.

- [ ] **Step 6: Build de producción**

Run: `pnpm --filter backoffice build`
Expected: build exitoso, mismas rutas que antes (24, sin cambios de
superficie).

- [ ] **Step 7: Recorrido manual mínimo en navegador**

Con `pnpm supabase start` y `pnpm --filter backoffice dev` corriendo:
login como `ceo@sumoto.co` / `sumoto123`, confirmar que `/ceo` carga con
los KPIs y la tabla de cartera por tienda sin error. Login como
`financiero@sumoto.co`, confirmar que `/cartera` carga igual.

- [ ] **Step 8: Commit**

```bash
git add "apps/backoffice/app/(financiero)/cartera/page.tsx" "apps/backoffice/app/(financiero)/cartera/exportar-recaudo/route.ts" "apps/backoffice/app/(financiero)/desembolsos/page.tsx" "apps/backoffice/app/(ceo)/ceo/page.tsx"
git commit -m "feat(backoffice): empresaId en reporteria — financiero y ceo (+ sesión nueva en 3 páginas)"
```

---

### Task 6: Suite de aislamiento entre tenants para `reporteria`

**Files:**
- Create: `packages/core/aislamiento-reporteria.e2e.test.ts`

**Interfaces:**
- Consumes: `ReporteriaService` resuelto vía `resolver`/`TOKENS` del
  container real (mismo patrón que `flow.e2e.test.ts`); fixture de
  empresa rival vía `service_role` (mismo patrón que
  `aislamiento-tenant.e2e.test.ts`).

**Nota — esto es un test tipo `aislamiento-tenant` (repositorio), NO tipo
`aislamiento-rls`:** las tablas de origen (`cartera.creditos`,
`originacion.solicitudes`) no tienen `empresa_id` propio ni RLS que lo
conozca todavía (fase 2 pendiente) — la única puerta real hoy es el
filtro de `ReporteriaService`. No escribir un test que dé a entender que
hay protección RLS aquí; ver spec sección 3.

- [ ] **Step 1: Escribir el test**

El fixture necesita un crédito activo con cuota vencida (para que
`cartera_por_credito`/`resumen_cartera`/`mora_por_franja` tengan algo que
mostrar) y una solicitud, en la empresa rival:

```typescript
// Aislamiento entre tenants para reporteria — a nivel de REPOSITORIO
// (ReporteriaService filtra por empresa_id explícito), NO a nivel RLS:
// cartera.creditos/originacion.solicitudes todavía no tienen empresa_id
// propio (fase 2 pendiente) — ver spec 2026-07-26-reporteria-empresa-id-design.md
// sección 3. Se corre manualmente:
// npx vitest run aislamiento-reporteria.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { ReporteriaService } from "./modules/reporteria/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const EMPRESA_SUMOTO = "d0000000-0000-4000-8000-000000000001";
const SUFIJO = Date.now().toString(36);

describe("aislamiento entre empresas — reporteria (filtro de repositorio)", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let creditoRival: string;

  beforeAll(async () => {
    arrancarNucleo({ supabase });

    const { data: empresa, error: errEmpresa } = await supabase
      .from("empresas")
      .insert({ nombre: "Rival Reporteria S.A.S.", slug: `rival-reporteria-${SUFIJO}` })
      .select("id")
      .single();
    if (errEmpresa) throw errEmpresa;
    empresaRival = empresa.id;

    const { data: tienda, error: errTienda } = await supabase
      .from("tiendas")
      .insert({ nombre: "Rival Reporteria Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    if (errTienda) throw errTienda;
    tiendaRival = tienda.id;

    const { data: cliente, error: errCliente } = await supabase
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: `21${Date.now().toString().slice(-8)}`,
        nombres: "Rita",
        apellidos: "Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();
    if (errCliente) throw errCliente;

    const { data: credito, error: errCredito } = await supabase
      .schema("cartera")
      .from("creditos")
      .insert({
        cliente_id: cliente.id,
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
    if (errCredito) throw errCredito;
    creditoRival = credito.id;

    const { error: errCuota } = await supabase
      .schema("cartera")
      .from("cuotas")
      .insert({
        credito_id: creditoRival,
        numero: 1,
        fecha_vencimiento: new Date().toISOString().slice(0, 10),
        capital_centavos: 40_000_000,
        interes_centavos: 7_000_000,
      });
    if (errCuota) throw errCuota;

    // solicitud propia (para probar solicitudesPaginadas) — producto_id y
    // moto_id referencian filas del seed de SUMOTO a propósito: ni
    // productos de crédito ni el catálogo de motos están acotados por
    // empresa todavía (fuera de alcance de este plan), así que cualquier
    // fila activa sirve como fixture. moto_id no tiene UUID fijo en el
    // seed (se genera con gen_random_uuid()) — hay que resolverlo en
    // tiempo de ejecución, no se puede hardcodear. creado_por reutiliza el
    // usuario vendedor real de SUMOTO (misma referencia cruzada que ya
    // usa flow.e2e.test.ts): la FK exige un auth.users real, y esto no
    // afecta el aislamiento que se está probando (creado_por no participa
    // en el filtro de empresa_id).
    const { data: motoCualquiera, error: errMoto } = await supabase
      .schema("catalogo")
      .from("motos")
      .select("id")
      .limit(1)
      .single();
    if (errMoto) throw errMoto;

    const { error: errSolicitud } = await supabase
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
        estado: "desembolsada",
        creado_por: "a0000000-0000-4000-8000-000000000001",
      });
    if (errSolicitud) throw errSolicitud;
  });

  it("SUMOTO nunca ve la cartera por tienda de la empresa rival", async () => {
    const reporteria = resolver<ReporteriaService>(TOKENS.reporteriaService);
    const porTienda = await reporteria.carteraPorTienda(EMPRESA_SUMOTO);
    expect(porTienda.find((t) => t.tienda_id === tiendaRival)).toBeUndefined();
  });

  it("SUMOTO nunca ve solicitudes de la empresa rival", async () => {
    const reporteria = resolver<ReporteriaService>(TOKENS.reporteriaService);
    const { items } = await reporteria.solicitudesPaginadas(EMPRESA_SUMOTO, {
      tiendaId: tiendaRival,
      pagina: 1,
      porPagina: 10,
    });
    // el filtro de empresa_id se aplica ANTES que tiendaId: aunque se pida
    // explícitamente la tienda rival, SUMOTO no puede verla — cero filas,
    // no un error, prueba que empresa_id gana sobre cualquier otro filtro.
    expect(items).toHaveLength(0);
  });

  it("la empresa rival SÍ ve su propia cartera por tienda y sus solicitudes", async () => {
    const reporteria = resolver<ReporteriaService>(TOKENS.reporteriaService);

    const porTienda = await reporteria.carteraPorTienda(empresaRival);
    const filaRival = porTienda.find((t) => t.tienda_id === tiendaRival);
    expect(filaRival).toBeDefined();
    expect(filaRival?.capital_total_centavos).toBeGreaterThan(0);

    const { items } = await reporteria.solicitudesPaginadas(empresaRival, {
      tiendaId: tiendaRival,
      pagina: 1,
      porPagina: 10,
    });
    expect(items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr y confirmar que pasa**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core exec vitest run aislamiento-reporteria.e2e.test.ts --config vitest.e2e.config.ts
```
Expected: PASS.

- [ ] **Step 3: Control negativo**

Comentar temporalmente el `.eq("empresa_id", empresaId)` en
`carteraPorTienda` (Tarea 2, Step 3), correr el test de nuevo, confirmar
que FALLA (la tienda rival aparece en la consulta de SUMOTO), revertir el
comentario, confirmar que vuelve a pasar. Documentar ambas corridas en el
reporte.

- [ ] **Step 4: Commit**

```bash
git add packages/core/aislamiento-reporteria.e2e.test.ts
git commit -m "test(reporteria): suite de aislamiento entre empresas (filtro de repositorio)"
```

---

### Task 7: Verificación final

**Files:** ninguno nuevo — solo comandos de verificación y actualización
de `docs/STATUS.md`.

- [ ] **Step 1: Typecheck limpio (core + backoffice)**

Run: `pnpm --filter @sumo/core typecheck && pnpm --filter backoffice exec tsc --noEmit`
Expected: ambos sin output, exit 0.

- [ ] **Step 2: Suite unitaria completa**

Run: `pnpm --filter @sumo/core test`
Expected: 138/138 passing (este plan no agrega tests unitarios nuevos,
solo e2e).

- [ ] **Step 3: Suite e2e completa (4 archivos)**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
export SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core test:e2e
```
Expected: `flow.e2e.test.ts` + `aislamiento-tenant.e2e.test.ts` +
`aislamiento-rls.e2e.test.ts` + `aislamiento-reporteria.e2e.test.ts`,
todos pasando.

- [ ] **Step 4: Build de producción**

Run: `pnpm --filter backoffice build`
Expected: exitoso, 24 rutas.

- [ ] **Step 5: Actualizar `docs/STATUS.md`**

Agregar entrada de bitácora fechada resumiendo: 8 vistas de `reporteria`
con `empresa_id`, `ReporteriaService` con `empresaId` obligatorio en 8
métodos, 10 call sites actualizados (3 con sesión nueva), suite de
aislamiento nueva. Marcar el ítem de `reporteria` (agregado en la fase 1
como "sigue pendiente") como resuelto — con la salvedad explícita de que
`asientos_recientes` queda fuera, documentada como gap para la fase 2 de
`cartera`+`contabilidad`.

- [ ] **Step 6: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): reporteria con empresa_id — cierra la fuga latente de la fase 1"
```

## Self-Review

**Cobertura de la spec:** secciones 4 (vistas), 5 (service), 6 (call
sites), 7 (testing) cubiertas por las Tareas 1-6 respectivamente; sección
9 (asientos_recientes fuera de alcance) respetada explícitamente en el
alcance de este plan.

**Placeholders:** ninguno — cada tarea trae el SQL/TS completo,
verificado contra `pg_get_viewdef` real (no reconstruido de memoria) y
contra el contenido actual de los 10 archivos del backoffice (leídos uno
por uno, no asumidos).

**Consistencia de tipos:** `empresaId: string` como primer parámetro
obligatorio en los 8 métodos de `ReporteriaService`, mismo orden en la
Tarea 2 (definición) y las Tareas 3-5 (call sites) — verificado método
por método al escribir cada before/after.

**Alcance verificado, no asumido:** de los 12 archivos que originalmente
parecían llamar `reporteriaService()`, 2 (`(contable)/contabilidad/
page.tsx` y `(contable)/contabilidad/exportar/route.ts`) solo usan
`asientosRecientes` — quedan fuera de este plan, confirmado leyendo cada
archivo completo antes de escribir las tareas.
