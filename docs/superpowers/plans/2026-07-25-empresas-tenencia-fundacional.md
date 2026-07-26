# Fundación multi-tenant (empresas + RLS transversal) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** introducir `empresas` como nuevo nivel transversal de aislamiento
(arriba de `tiendas`/`perfiles`), demostrar el patrón completo (RLS +
dominio + repositorio + service + app) en el módulo `clientes`, y dejar una
suite de tests que verifique NEGATIVAMENTE que ninguna empresa ve datos de
otra — sin romper el demo actual de SUMOTO ni ningún test existente.

**Architecture:** ver
`docs/superpowers/specs/2026-07-25-saas-multitenant-foundation-design.md`
secciones 3 y 9. Aislamiento por RLS con columna `empresa_id` (no
schema-por-tenant). El core sigue usando `service_role` (bypassa RLS), así
que la seguridad real depende de que CADA repositorio filtre `empresa_id`
explícitamente además de que la RLS exista como segunda puerta — mismo
patrón que ya usa `tienda_id` hoy en `RepositorioClientesSupabase`.

**Tech Stack:** Supabase (Postgres + RLS), TypeScript estricto, vitest,
Next.js 16 App Router (route handlers/server actions/server components).

## Alcance de este plan (fase 1 de 2 planeadas)

**Dentro:** tabla `public.empresas`, función `empresa_actual()`,
`empresa_id` en `tiendas`/`perfiles`, corrección de dos fugas de RLS que
existen HOY (`tiendas_lectura` y `perfiles_lectura_gestion` no acotan por
empresa), y el módulo `clientes` completo (DB + dominio + repositorio +
caso de uso + service + las 6 llamadas del backoffice que lo usan) como
implementación de referencia end-to-end. Suite de aislamiento entre
tenants para `clientes`.

**Fuera (plan separado, mismo patrón, menor riesgo una vez esto exista):**
`originacion`, `cartera`+`links`, `contabilidad`, `catalogo`, `agenda` —
cada uno repite EXACTAMENTE el mismo patrón que la Tarea 3 de este plan
aplica a `clientes`. También quedan fuera: catálogo genérico de
productos/servicios, motor de políticas configurable, RBAC configurable,
auditoría — son secciones 4-7 de la spec, temas de planes posteriores.

## Global Constraints

- Dinero SIEMPRE en centavos enteros (`bigint`), nunca float.
- TypeScript estricto, sin `any` sin justificar en comentario.
- Nombres de dominio en español (`empresaId`, `empresa_id`); técnico/infra
  en inglés está bien.
- Toda mutación de esquema es una migración versionada
  (`pnpm supabase migration new <nombre>`), nunca configuración por clicks
  en Studio.
- Un schema de Postgres por MÓDULO se preserva intacto — `empresa_id` es
  una columna nueva en tablas existentes, no un schema nuevo por tenant.
- RLS en dos puertas: RLS de Postgres + filtro explícito en el
  repositorio (el core usa `service_role`, que bypassa RLS).
- **Excepción confirmada por Julián (2026-07-25) para esta ejecución
  subagent-driven, en worktree aislado:** cada tarea SÍ termina con
  `git add`/`git commit` real, con mensaje convencional en español. Esto
  reemplaza la regla general del proyecto (fuera de este flujo, Claude
  nunca commitea) — aplica solo dentro de esta fase.
- Comandos pnpm siempre desde la raíz del repo
  (`pnpm --filter @sumo/core ...`, `pnpm --filter backoffice ...`).

---

### Task 1: Tabla `empresas`, `empresa_actual()`, `empresa_id` en `tiendas`/`perfiles`, fix de 2 fugas RLS

**Files:**
- Create: `supabase/migrations/20260725180000_empresas_tenencia.sql`
- Modify: `supabase/seed.sql:8-50` (bloques 1 y 2 — tiendas y usuarios/perfiles)

**Interfaces:**
- Produces: tabla `public.empresas(id, nombre, slug, plan, estado, creado_en)`;
  función `public.empresa_actual() returns uuid`; columna
  `public.tiendas.empresa_id uuid not null`; columna
  `public.perfiles.empresa_id uuid not null`. Todo esto lo consumen las
  Tareas 2 y 3.

- [ ] **Step 1: Escribir la migración**

```sql
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

alter table public.empresas enable row level security;

-- Un usuario ve el nombre/plan de SU propia empresa, nunca el de otra.
create policy empresas_lectura on public.empresas
  for select to authenticated
  using (id = (select empresa_id from public.perfiles where user_id = auth.uid()));

alter table public.tiendas add column empresa_id uuid references public.empresas (id);
alter table public.perfiles add column empresa_id uuid references public.empresas (id);

-- Proyecto en fase demo: `supabase db reset` siembra desde cero en cada
-- corrida, no hay datos preexistentes que romper al exigir NOT NULL de una vez.
alter table public.tiendas alter column empresa_id set not null;
alter table public.perfiles alter column empresa_id set not null;

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
```

- [ ] **Step 2: Actualizar el seed para crear la empresa SUMOTO y asignarla**

En `supabase/seed.sql`, ANTES del bloque `-- 1. Tiendas` (línea 8), agregar:

```sql
-- 0. Empresa (SUMOTO es la empresa #1 del sistema, dogfooding) --------------
insert into public.empresas (id, nombre, slug, plan) values
  ('d0000000-0000-4000-8000-000000000001', 'SUMOTO', 'sumoto', 'demo');
```

Modificar el bloque `-- 1. Tiendas` (líneas 8-10) para incluir `empresa_id`:

```sql
insert into public.tiendas (id, nombre, ciudad, meta_colocacion_centavos, empresa_id) values
  ('11111111-1111-4111-8111-111111111111', 'SUMOTO Bogotá Norte', 'Bogotá', 2500000000, 'd0000000-0000-4000-8000-000000000001'),
  ('22222222-2222-4222-8222-222222222222', 'SUMOTO Medellín Centro', 'Medellín', 2000000000, 'd0000000-0000-4000-8000-000000000001');
```

En el bloque `-- 2. Usuarios por rol` (líneas 12-50), el `insert into
public.perfiles` (línea 46-48) queda:

```sql
    insert into public.perfiles (user_id, rol, tienda_id, nombre, empresa_id)
    values ((u->>'id')::uuid, (u->>'rol')::public.rol_usuario,
            (u->>'tienda')::uuid, u->>'nombre',
            'd0000000-0000-4000-8000-000000000001');
```

- [ ] **Step 3: Verificar que el reset de Supabase local aplica todo sin error**

Run: `pnpm supabase db reset`
Expected: termina sin errores; el resumen final lista la migración
`20260725180000_empresas_tenencia` aplicada y el seed corrido.

- [ ] **Step 4: Verificar manualmente el aislamiento base con psql**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select nombre, empresa_id from public.tiendas; select nombre, rol, empresa_id from public.perfiles limit 3;"
```
Expected: todas las filas muestran `empresa_id = d0000000-0000-4000-8000-000000000001`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260725180000_empresas_tenencia.sql supabase/seed.sql
git commit -m "feat(seguridad): tabla empresas y empresa_actual() — fundación multi-tenant"
```

---

### Task 2: `empresaId` en el perfil de seguridad (dominio + repositorio)

**Files:**
- Modify: `packages/core/modules/seguridad/domain/profile.ts`
- Modify: `packages/core/modules/seguridad/infrastructure/supabase-profile-repository.ts`

**Interfaces:**
- Consumes: columna `public.perfiles.empresa_id` (Tarea 1).
- Produces: `Perfil.empresaId: string` — lo consume `apps/backoffice/lib/auth.ts`
  automáticamente (su `Sesion extends Perfil`, sin cambios de código ahí)
  y la Tarea 4 (los call sites del backoffice).

- [ ] **Step 1: Agregar `empresaId` a la interfaz `Perfil`**

En `packages/core/modules/seguridad/domain/profile.ts`, modificar:

```typescript
export interface Perfil {
  userId: string;
  nombre: string;
  rol: Rol;
  tiendaId: string | null;
  empresaId: string;
}
```

- [ ] **Step 2: Leer `empresa_id` en el repositorio**

En `packages/core/modules/seguridad/infrastructure/supabase-profile-repository.ts`,
modificar la interfaz `FilaPerfil` y el mapeo:

```typescript
interface FilaPerfil {
  user_id: string;
  nombre: string;
  rol: Rol;
  tienda_id: string | null;
  empresa_id: string;
}

export class RepositorioPerfilesSupabase implements RepositorioPerfiles {
  constructor(private readonly supabase: SupabaseClient) {}

  async buscarPorUsuario(userId: string): Promise<Perfil | null> {
    const { data, error } = await this.supabase
      .from("perfiles")
      .select("user_id, nombre, rol, tienda_id, empresa_id")
      .eq("user_id", userId)
      .maybeSingle<FilaPerfil>();
    if (error) throw new Error(`[seguridad] error leyendo perfil: ${error.message}`);
    return data
      ? {
          userId: data.user_id,
          nombre: data.nombre,
          rol: data.rol,
          tiendaId: data.tienda_id,
          empresaId: data.empresa_id,
        }
      : null;
  }
}
```

- [ ] **Step 3: Verificar el typecheck del core**

Run: `pnpm --filter @sumo/core exec tsc --noEmit`
Expected: sin errores (nada más en el core consume `Perfil` con campos
faltantes todavía, `ClientesService`/etc. se ajustan en la Tarea 3).

- [ ] **Step 4: Commit**

```bash
git add packages/core/modules/seguridad/domain/profile.ts packages/core/modules/seguridad/infrastructure/supabase-profile-repository.ts
git commit -m "feat(seguridad): Perfil incluye empresaId"
```

---

### Task 3: Módulo `clientes` — `empresa_id` de punta a punta (referencia del patrón)

**Files:**
- Create: `supabase/migrations/20260725181000_clientes_empresa_id.sql`
- Modify: `supabase/seed.sql` (el `insert into clientes.clientes` dentro del loop de 18 créditos)
- Modify: `packages/core/modules/clientes/domain/client.ts`
- Modify: `packages/core/modules/clientes/domain/client-repository.ts`
- Modify: `packages/core/modules/clientes/infrastructure/client-mapper.ts`
- Modify: `packages/core/modules/clientes/infrastructure/supabase-client-repository.ts`
- Modify: `packages/core/modules/clientes/application/register-client.ts`
- Modify: `packages/core/modules/clientes/application/register-client.test.ts`
- Modify: `packages/core/modules/clientes/domain/client.test.ts`
- Modify: `packages/core/modules/clientes/service.ts`

**Interfaces:**
- Consumes: `public.empresa_actual()` (Tarea 1), `Perfil.empresaId` (Tarea 2).
- Produces: `Cliente.empresaId: string`; `RepositorioClientes.buscarPorCedula(cedula, empresaId)`,
  `.buscarPorId(id, empresaId)`, `.buscar(query, empresaId, tiendaId?)` — firmas
  que consume la Tarea 4 (call sites del backoffice).

- [ ] **Step 1: Migración — columna `empresa_id` + RLS en `clientes.clientes`**

```sql
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
```

- [ ] **Step 2: Actualizar el seed — el insert de clientes dentro del loop**

En `supabase/seed.sql`, el `insert into clientes.clientes` (dentro del
`do $$ ... end $$` que siembra los 18 créditos) pasa de:

```sql
    insert into clientes.clientes
      (cedula, nombres, apellidos, fecha_nacimiento, telefono, ciudad,
       ingresos_declarados_centavos, fuente_identidad, tienda_id)
    values
      ((1000000000 + i)::text, nombres[i], apellidos[i] || ' ' || apellidos[1 + (i % 18)],
       ('1975-01-15'::date + (i * 400 || ' days')::interval)::date,
       '31055512' || lpad(i::text, 2, '0'), case when i % 2 = 0 then 'Bogotá' else 'Medellín' end,
       ingresos, case when i % 3 = 0 then 'escaner' else 'entrada_manual' end, tienda)
    returning id into v_cliente;
```

a:

```sql
    insert into clientes.clientes
      (cedula, nombres, apellidos, fecha_nacimiento, telefono, ciudad,
       ingresos_declarados_centavos, fuente_identidad, tienda_id, empresa_id)
    values
      ((1000000000 + i)::text, nombres[i], apellidos[i] || ' ' || apellidos[1 + (i % 18)],
       ('1975-01-15'::date + (i * 400 || ' days')::interval)::date,
       '31055512' || lpad(i::text, 2, '0'), case when i % 2 = 0 then 'Bogotá' else 'Medellín' end,
       ingresos, case when i % 3 = 0 then 'escaner' else 'entrada_manual' end, tienda,
       'd0000000-0000-4000-8000-000000000001')
    returning id into v_cliente;
```

- [ ] **Step 3: Verificar que el reset aplica sin error**

Run: `pnpm supabase db reset`
Expected: sin errores.

- [ ] **Step 4: Entidad de dominio — agregar `empresaId`**

En `packages/core/modules/clientes/domain/client.ts`:

```typescript
export interface Cliente {
  id?: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  estrato?: number;
  geoCoincide?: boolean;
  ingresosDeclaradosCentavos?: number;
  fuenteIdentidad: FuenteDeDatos;
  tiendaId: string;
  empresaId: string;
}

export interface DatosRegistro {
  ingresosDeclaradosCentavos?: number;
  fuenteIdentidad: FuenteDeDatos;
  tiendaId: string;
  empresaId: string;
}
```

Y en `crearCliente`, agregar `empresaId: registro.empresaId,` al objeto
devuelto por `exito({ ... })` (junto a `tiendaId: registro.tiendaId,`).

En `validarParaRegistro`, agregar la validación simétrica a la de
`tiendaId` (después del bloque que valida `registro.tiendaId.trim() === ""`):

```typescript
  if (registro.empresaId.trim() === "") {
    violaciones.push("la empresa que registra es obligatoria");
  }
```

- [ ] **Step 5: Escribir el test de dominio que falla**

En `packages/core/modules/clientes/domain/client.test.ts`, agregar (revisar
el archivo existente para reusar sus helpers de `DatosCiudadano` válidos ya
presentes — usar el mismo shape base y solo variar `empresaId`):

```typescript
it("rechaza el registro sin empresaId", () => {
  const resultado = crearCliente(datosCiudadanoValidos, {
    fuenteIdentidad: "entrada_manual",
    tiendaId: "11111111-1111-4111-8111-111111111111",
    empresaId: "",
  });
  expect(resultado.ok).toBe(false);
  if (!resultado.ok) {
    expect(resultado.error).toContain("la empresa que registra es obligatoria");
  }
});
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `pnpm --filter @sumo/core exec vitest run domain/client.test.ts -t "empresaId"`
Expected: FAIL — `empresaId` no existe todavía en `DatosRegistro` (error de
tipos) o el test no encuentra la violación esperada.

- [ ] **Step 7: Confirmar que el Step 4 ya lo hace pasar**

Run: `pnpm --filter @sumo/core exec vitest run domain/client.test.ts`
Expected: PASS (todos los tests del archivo, incluido el nuevo).

- [ ] **Step 8: Contrato del repositorio — agregar `empresaId` a las firmas**

En `packages/core/modules/clientes/domain/client-repository.ts`:

```typescript
export interface RepositorioClientes {
  guardar(cliente: Cliente): Promise<Cliente>;
  buscarPorCedula(cedula: string, empresaId: string): Promise<Cliente | null>;
  buscarPorId(id: string, empresaId: string): Promise<Cliente | null>;
  // tiendaId acota a vendedor/manager (misma regla que la RLS de lectura);
  // omitirlo es para roles de alcance nacional (financiero/contable/ceo).
  // empresaId SIEMPRE se exige: cruzar el límite de empresa nunca es legítimo.
  buscar(query: string, empresaId: string, tiendaId?: string): Promise<Cliente[]>;
}
```

- [ ] **Step 9: Mapper — incluir `empresa_id`**

En `packages/core/modules/clientes/infrastructure/client-mapper.ts`:

```typescript
export interface FilaCliente {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  estrato: number | null;
  geo_coincide: boolean | null;
  ingresos_declarados_centavos: number | null;
  fuente_identidad: FuenteDeDatos;
  tienda_id: string;
  empresa_id: string;
}

export function aCliente(fila: FilaCliente): Cliente {
  return {
    id: fila.id,
    cedula: fila.cedula,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    fechaNacimiento: fila.fecha_nacimiento ?? undefined,
    telefono: fila.telefono ?? undefined,
    email: fila.email ?? undefined,
    direccion: fila.direccion ?? undefined,
    ciudad: fila.ciudad ?? undefined,
    estrato: fila.estrato ?? undefined,
    geoCoincide: fila.geo_coincide ?? undefined,
    ingresosDeclaradosCentavos: fila.ingresos_declarados_centavos ?? undefined,
    fuenteIdentidad: fila.fuente_identidad,
    tiendaId: fila.tienda_id,
    empresaId: fila.empresa_id,
  };
}

export function aFilaNueva(cliente: Cliente): Omit<FilaCliente, "id"> {
  return {
    cedula: cliente.cedula,
    nombres: cliente.nombres,
    apellidos: cliente.apellidos,
    fecha_nacimiento: cliente.fechaNacimiento ?? null,
    telefono: cliente.telefono ?? null,
    email: cliente.email ?? null,
    direccion: cliente.direccion ?? null,
    ciudad: cliente.ciudad ?? null,
    estrato: cliente.estrato ?? null,
    geo_coincide: cliente.geoCoincide ?? null,
    ingresos_declarados_centavos: cliente.ingresosDeclaradosCentavos ?? null,
    fuente_identidad: cliente.fuenteIdentidad,
    tienda_id: cliente.tiendaId,
    empresa_id: cliente.empresaId,
  };
}
```

- [ ] **Step 10: Repositorio Supabase — filtrar SIEMPRE por `empresa_id`**

En `packages/core/modules/clientes/infrastructure/supabase-client-repository.ts`:

```typescript
export class RepositorioClientesSupabase implements RepositorioClientes {
  constructor(private readonly supabase: SupabaseClient) {}

  async guardar(cliente: Cliente): Promise<Cliente> {
    const { data, error } = await this.supabase
      .schema("clientes")
      .from("clientes")
      .insert(aFilaNueva(cliente))
      .select()
      .single<FilaCliente>();

    if (error) {
      throw new Error(`[clientes] error guardando cliente: ${error.message}`);
    }
    return aCliente(data);
  }

  async buscarPorCedula(cedula: string, empresaId: string): Promise<Cliente | null> {
    const { data, error } = await this.supabase
      .schema("clientes")
      .from("clientes")
      .select()
      .eq("cedula", cedula)
      .eq("empresa_id", empresaId)
      .maybeSingle<FilaCliente>();

    if (error) {
      throw new Error(`[clientes] error buscando por cédula: ${error.message}`);
    }
    return data ? aCliente(data) : null;
  }

  async buscarPorId(id: string, empresaId: string): Promise<Cliente | null> {
    const { data, error } = await this.supabase
      .schema("clientes")
      .from("clientes")
      .select()
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle<FilaCliente>();

    if (error) {
      throw new Error(`[clientes] error buscando por id: ${error.message}`);
    }
    return data ? aCliente(data) : null;
  }

  async buscar(query: string, empresaId: string, tiendaId?: string): Promise<Cliente[]> {
    const limpia = query.trim().replace(/[,()*\\."']/g, "");
    if (!limpia) return [];

    let consulta = this.supabase
      .schema("clientes")
      .from("clientes")
      .select()
      .eq("empresa_id", empresaId)
      .or(`nombres.ilike.%${limpia}%,apellidos.ilike.%${limpia}%,cedula.ilike.%${limpia}%`)
      .order("nombres")
      .limit(8);

    if (tiendaId) {
      consulta = consulta.eq("tienda_id", tiendaId);
    }

    const { data, error } = await consulta.returns<FilaCliente[]>();
    if (error) {
      throw new Error(`[clientes] error buscando clientes: ${error.message}`);
    }
    return (data ?? []).map(aCliente);
  }
}
```

- [ ] **Step 11: Caso de uso `RegistrarCliente` — agregar `empresaId` al comando**

En `packages/core/modules/clientes/application/register-client.ts`:

```typescript
export interface ComandoRegistrarCliente {
  fuente: FuenteDeDatos;
  entradaCruda: unknown;
  ingresosDeclaradosCentavos?: number;
  tiendaId: string;
  empresaId: string;
}

export class RegistrarCliente {
  constructor(
    private readonly fuentes: FuenteIdentidad[],
    private readonly repositorio: RepositorioClientes,
    private readonly bus: EventBus,
  ) {}

  async ejecutar(
    comando: ComandoRegistrarCliente,
  ): Promise<Resultado<Cliente, string[]>> {
    const fuente = this.fuentes.find((f) => f.nombre === comando.fuente);
    if (!fuente) {
      return fallo([`fuente de identidad desconocida: ${comando.fuente}`]);
    }

    const captura = await fuente.capturar(comando.entradaCruda);
    if (!captura.ok) {
      return fallo([captura.error]);
    }

    // Idempotencia por cédula ACOTADA a la empresa: dos empresas distintas
    // pueden tener cada una un cliente con la misma cédula (personas
    // distintas registradas por negocios distintos, o el mismo cliente
    // real siendo sujeto de crédito en dos empresas independientes).
    const existente = await this.repositorio.buscarPorCedula(
      captura.valor.cedula,
      comando.empresaId,
    );
    if (existente) {
      return exito(existente);
    }

    const creacion = crearCliente(captura.valor, {
      ingresosDeclaradosCentavos: comando.ingresosDeclaradosCentavos,
      fuenteIdentidad: fuente.nombre,
      tiendaId: comando.tiendaId,
      empresaId: comando.empresaId,
    });
    if (!creacion.ok) {
      return creacion;
    }

    const guardado = await this.repositorio.guardar(creacion.valor);

    await this.bus.emit("clientes.cliente.registrado", {
      clienteId: guardado.id,
      cedula: guardado.cedula,
      tiendaId: guardado.tiendaId,
    });

    return exito(guardado);
  }
}
```

Nota: la idempotencia de `buscarPorCedula` ahora es correcta porque la
cédula dejó de ser única GLOBALMENTE — es única POR EMPRESA (constraint
`clientes_cedula_empresa_key`, ya creada en el Step 1 de esta tarea). Dos
empresas distintas pueden registrar cada una un cliente con la misma
cédula sin chocar entre sí.

- [ ] **Step 12: Actualizar el test existente del caso de uso**

En `packages/core/modules/clientes/application/register-client.test.ts`,
localizar cada llamada a `casoRegistrar.ejecutar({ ... })` y agregar
`empresaId: "d0000000-0000-4000-8000-000000000001"` (o el UUID de prueba
que ya use el archivo) a cada comando de prueba. Localizar también el
fake/mock de `RepositorioClientes` en ese archivo y actualizar las firmas
de sus métodos (`buscarPorCedula`, `buscarPorId`, `buscar`) para aceptar
el nuevo parámetro `empresaId` aunque el fake lo ignore internamente.

- [ ] **Step 13: Correr toda la suite del core**

Run: `pnpm --filter @sumo/core test`
Expected: PASS — 137+ tests en verde (el conteo exacto puede variar por
el test nuevo del Step 5; ninguno debe fallar).

- [ ] **Step 14: Fachada `ClientesService` — propagar `empresaId`**

En `packages/core/modules/clientes/service.ts`:

```typescript
export class ClientesService {
  constructor(
    private readonly casoRegistrar: RegistrarCliente,
    private readonly repositorio: RepositorioClientes,
  ) {}

  registrarCliente(comando: ComandoRegistrarCliente) {
    return this.casoRegistrar.ejecutar(comando);
  }

  buscarPorCedula(cedula: string, empresaId: string) {
    return this.repositorio.buscarPorCedula(cedula, empresaId);
  }

  buscarPorId(id: string, empresaId: string) {
    return this.repositorio.buscarPorId(id, empresaId);
  }

  buscarClientes(query: string, empresaId: string, tiendaId?: string) {
    return this.repositorio.buscar(query, empresaId, tiendaId);
  }
}
```

- [ ] **Step 15: Commit**

```bash
git add supabase/migrations/20260725181000_clientes_empresa_id.sql supabase/seed.sql packages/core/modules/clientes/
git commit -m "feat(clientes): empresa_id de punta a punta — patrón de referencia multi-tenant"
```

---

### Task 4: Actualizar los 6 puntos del backoffice que llaman a `ClientesService`

**Files:**
- Modify: `apps/backoffice/app/(compartido)/buscar/page.tsx:34-37`
- Modify: `apps/backoffice/app/(compartido)/clientes/[cedula]/page.tsx:42`
- Modify: `apps/backoffice/app/api/clientes/route.ts:22-28`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/identidad/route.ts:13-18`
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/nueva/page.tsx:76-80`
- Modify: `apps/backoffice/app/(vendedor)/solicitudes/nueva/actions.ts:36-39`
- Modify: `apps/backoffice/app/(financiero)/desembolsos/[solicitudId]/page.tsx:49-67`

**Interfaces:**
- Consumes: `ClientesService.buscarPorCedula(cedula, empresaId)`,
  `.buscarPorId(id, empresaId)`, `.buscarClientes(query, empresaId, tiendaId?)`,
  `.registrarCliente({ ..., empresaId })` (Tarea 3); `Sesion.empresaId`
  (Tarea 2, ya disponible sin cambios en `lib/auth.ts` porque `Sesion extends Perfil`).

- [ ] **Step 1: `buscar/page.tsx` — pasar `sesion.empresaId`**

Línea 34-37, cambiar:
```typescript
      ? await clientesService().buscarClientes(
          query,
          alcanceNacional ? undefined : sesion.tiendaId!,
        )
```
a:
```typescript
      ? await clientesService().buscarClientes(
          query,
          sesion.empresaId,
          alcanceNacional ? undefined : sesion.tiendaId!,
        )
```

- [ ] **Step 2: `clientes/[cedula]/page.tsx` — pasar `sesion.empresaId`**

Línea 42, cambiar:
```typescript
  const clienteCrudo = sesion ? await clientesService().buscarPorCedula(cedula) : null;
```
a:
```typescript
  const clienteCrudo = sesion
    ? await clientesService().buscarPorCedula(cedula, sesion.empresaId)
    : null;
```

- [ ] **Step 3: `api/clientes/route.ts` — el comando ya tiene `sesion`, agregar `empresaId`**

Línea 22-28, agregar `empresaId: sesion.empresaId,` al objeto pasado a
`registrarCliente({ ... })` (junto a `tiendaId: sesion.tiendaId,`).

- [ ] **Step 4: `desembolsos/[solicitudId]/identidad/route.ts` — pasar `sesion.empresaId`**

Línea 18, cambiar:
```typescript
  const cliente = par ? await clientesService().buscarPorId(par.solicitud.clienteId) : null;
```
a:
```typescript
  const cliente = par
    ? await clientesService().buscarPorId(par.solicitud.clienteId, sesion.empresaId)
    : null;
```
(`sesion` ya existe en ese archivo desde `exigirRol(["financiero"])`, línea 13.)

- [ ] **Step 5: `solicitudes/nueva/page.tsx` — pasar `sesion.empresaId`**

Línea 76-80, cambiar:
```typescript
  const sesion = await obtenerSesion();
  const tiendaId = sesion?.tiendaId ?? null;

  const clienteCrudo =
    params.cedula && tiendaId ? await clientesService().buscarPorCedula(params.cedula) : null;
```
a:
```typescript
  const sesion = await obtenerSesion();
  const tiendaId = sesion?.tiendaId ?? null;

  const clienteCrudo =
    params.cedula && tiendaId && sesion
      ? await clientesService().buscarPorCedula(params.cedula, sesion.empresaId)
      : null;
```

- [ ] **Step 6: `solicitudes/nueva/actions.ts` — el comando ya tiene `sesion`, agregar `empresaId`**

Línea 36-39, agregar `empresaId: sesion.empresaId,` al objeto pasado a
`registrarCliente({ ... })` (junto a `tiendaId: sesion.tiendaId!,`).

- [ ] **Step 7: `desembolsos/[solicitudId]/page.tsx` — este archivo NO resuelve sesión hoy, agregarla**

Este server component depende hoy 100% del `exigirRol(["financiero"])`
del layout `(financiero)` — no llama `obtenerSesion()` él mismo. Agregar
el import y la llamada:

```typescript
import { obtenerSesion } from "@/lib/auth";
```

Y dentro de `ExpedientePage`, antes de `const par = await originacionService()...`:

```typescript
  const sesion = await obtenerSesion();
  if (!sesion) notFound();
```

Luego cambiar línea 65:
```typescript
    clientesService().buscarPorId(par.solicitud.clienteId),
```
a:
```typescript
    clientesService().buscarPorId(par.solicitud.clienteId, sesion.empresaId),
```

- [ ] **Step 8: Typecheck completo del backoffice**

Run: `pnpm --filter backoffice build`
Expected: build exitoso, sin errores de tipos en ninguno de los 7 archivos tocados.

- [ ] **Step 9: Commit**

```bash
git add apps/backoffice/app/
git commit -m "feat(backoffice): propagar empresaId en las llamadas a ClientesService"
```

---

### Task 5: Suite de aislamiento entre tenants (obligatoria, contra Supabase local real)

**Files:**
- Create: `packages/core/aislamiento-tenant.e2e.test.ts`

**Interfaces:**
- Consumes: `arrancarNucleo` (`packages/core/bootstrap.ts`), `resolver`/`TOKENS`
  (`packages/core/kernel/container.ts`), `ClientesService` (Tarea 3), datos
  del seed (empresa SUMOTO `d0000000-0000-4000-8000-000000000001`, tienda
  `11111111-1111-4111-8111-111111111111`) — mismo patrón que
  `packages/core/flow.e2e.test.ts`.

- [ ] **Step 1: Escribir el test que crea una segunda empresa y verifica fuga cero**

```typescript
// Aislamiento entre tenants (empresas): la fuga de datos entre
// empresas-cliente es el riesgo más grave del pivote multi-tenant — este
// test NUNCA debe fallar. Se corre manualmente contra Supabase local:
// npx vitest run aislamiento-tenant.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { ClientesService } from "./modules/clientes/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const EMPRESA_SUMOTO = "d0000000-0000-4000-8000-000000000001";
const TIENDA_SUMOTO = "11111111-1111-4111-8111-111111111111";
const CEDULA_COMPARTIDA = "1099999977"; // misma cédula en las dos empresas a propósito

describe("aislamiento entre empresas (tenants)", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let clienteRival: string;

  beforeAll(async () => {
    arrancarNucleo({ supabase });

    const { data: empresa, error: errEmpresa } = await supabase
      .from("empresas")
      .insert({ nombre: "Rival S.A.S.", slug: "rival-sas" })
      .select("id")
      .single();
    if (errEmpresa) throw errEmpresa;
    empresaRival = empresa.id;

    const { data: tienda, error: errTienda } = await supabase
      .from("tiendas")
      .insert({ nombre: "Rival Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    if (errTienda) throw errTienda;
    tiendaRival = tienda.id;

    const { data: cliente, error: errCliente } = await supabase
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: CEDULA_COMPARTIDA,
        nombres: "Ricardo",
        apellidos: "Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();
    if (errCliente) throw errCliente;
    clienteRival = cliente.id;
  });

  it("buscarPorCedula de SUMOTO nunca ve al cliente de la empresa rival", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const encontrado = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, EMPRESA_SUMOTO);
    expect(encontrado).toBeNull();
  });

  it("buscarPorId de SUMOTO nunca ve al cliente de la empresa rival", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const encontrado = await clientes.buscarPorId(clienteRival, EMPRESA_SUMOTO);
    expect(encontrado).toBeNull();
  });

  it("buscarClientes de SUMOTO nunca incluye clientes de la empresa rival", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const resultados = await clientes.buscarClientes("Rival", EMPRESA_SUMOTO);
    expect(resultados.find((c) => c.id === clienteRival)).toBeUndefined();
  });

  it("buscarPorCedula de la empresa rival SÍ ve a su propio cliente", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const encontrado = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, empresaRival);
    expect(encontrado?.id).toBe(clienteRival);
  });

  it("un cliente con la MISMA cédula puede existir en dos empresas distintas", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const deSumoto = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, EMPRESA_SUMOTO);
    expect(deSumoto).toBeNull(); // SUMOTO no sembró esta cédula en su seed
    const deRival = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, empresaRival);
    expect(deRival).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr la suite y verificar que pasa**

Run: `pnpm --filter @sumo/core exec vitest run aislamiento-tenant.e2e.test.ts --config vitest.e2e.config.ts`
Expected: PASS — las 5 verificaciones en verde. Requiere
`pnpm supabase start` corriendo y `SUPABASE_SERVICE_ROLE_KEY` exportada
(mismo requisito que `flow.e2e.test.ts`, documentado en STATUS.md).

- [ ] **Step 3: Confirmar que este test SÍ falla si se rompe el aislamiento (control negativo)**

Comentar temporalmente el `.eq("empresa_id", empresaId)` en
`buscarPorCedula` de `RepositorioClientesSupabase` (Tarea 3, Step 10),
correr el test de nuevo, confirmar que FALLA (el cliente rival aparece),
y luego revertir el comentario. Este paso prueba que el test realmente
detecta la fuga que dice detectar — no solo que pasa por casualidad.

- [ ] **Step 4: Commit**

```bash
git add packages/core/aislamiento-tenant.e2e.test.ts
git commit -m "test(clientes): suite de aislamiento entre empresas (tenants)"
```

---

### Task 6: Verificación final de la fase 1

**Files:** ninguno nuevo — solo comandos de verificación.

- [ ] **Step 1: Suite unitaria completa del core**

Run: `pnpm --filter @sumo/core test`
Expected: PASS, 0 fallos.

- [ ] **Step 2: Suite E2E completa (incluye `flow.e2e.test.ts` y el nuevo `aislamiento-tenant.e2e.test.ts`)**

Run: `pnpm --filter @sumo/core test:e2e`
Expected: PASS, 0 fallos. Si `flow.e2e.test.ts` falla, es señal de que
algo del cambio de `empresa_id` rompió el flujo de negocio existente —
diagnosticar antes de continuar, no ignorar.

- [ ] **Step 3: Build de producción del backoffice**

Run: `pnpm --filter backoffice build`
Expected: build exitoso, mismas rutas que antes.

- [ ] **Step 4: Recorrido manual mínimo en navegador**

Con `pnpm supabase start` y `pnpm --filter backoffice dev` corriendo:
login como `vendedor@sumoto.co` / `sumoto123`, ir a `/solicitudes/nueva`,
buscar un cliente existente por cédula (del seed) y confirmar que
aparece. Esto verifica que el flujo real de la demo sigue funcionando
con `empresaId` viajando de punta a punta, no solo los tests.

- [ ] **Step 5: Actualizar `docs/STATUS.md`**

Agregar a la bitácora una entrada fechada de hoy resumiendo: tabla
`empresas` + `empresa_actual()` + `empresa_id` en `tiendas`/`perfiles`;
2 fugas de RLS corregidas (`tiendas_lectura`, `perfiles_lectura_gestion`);
módulo `clientes` migrado como referencia del patrón; suite de
aislamiento entre tenants agregada. Mover el punto "1. Módulo `clientes`
— `empresa_id` de punta a punta" (si existe en "Siguiente") a "Hecho", y
agregar a "Siguiente": aplicar el mismo patrón a `originacion`,
`cartera`+`links`, `contabilidad`, `catalogo`, `agenda` (plan separado).

- [ ] **Step 6: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): fase 1 de multi-tenencia completa — empresas + clientes de referencia"
```

---

## Self-Review (completado por el autor del plan)

**Cobertura de la spec:** este plan cubre la sección 3 completa (tenencia)
y demuestra el patrón que las secciones 4-7 (catálogo, políticas, RBAC,
auditoría) replicarán en planes posteriores — según lo acordado
explícitamente en el alcance de arriba. La sección 9 (testing de
aislamiento) está cubierta por la Tarea 5, incluyendo el control negativo
del Step 3 (verificar que el test realmente detecta la fuga).

**Placeholders:** ninguno — cada paso trae el código completo a escribir,
no una descripción de qué hacer.

**Consistencia de tipos:** `Cliente.empresaId: string`,
`Perfil.empresaId: string`, `RepositorioClientes.buscarPorCedula(cedula,
empresaId)` — mismo orden y tipo en las 3 capas (dominio, mapper,
repositorio) y en los 7 call sites de la Tarea 4. `ComandoRegistrarCliente.empresaId`
coincide con el `DatosRegistro.empresaId` que consume `crearCliente`.
