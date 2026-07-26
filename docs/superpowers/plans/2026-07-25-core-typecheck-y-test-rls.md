# Typecheck real del core + test de aislamiento RLS — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cerrar dos huecos de deuda técnica detectados en el review final
de la fase 1 de multi-tenencia: `packages/core` no tiene typecheck real
(nada detecta una firma rota en sus archivos de test), y la suite de
aislamiento entre tenants solo prueba el filtro del repositorio, nunca
las políticas RLS mismas contra un usuario autenticado real.

**Architecture:** ver
`docs/superpowers/specs/2026-07-25-core-typecheck-y-test-rls-design.md`.
Un `tsconfig.json` nuevo en `packages/core` (hoy inexistente) cubriendo
TODO `.ts` incluidos los tests; un test e2e nuevo que se autentica con la
llave anon (camino real de producción, no un atajo) y verifica RLS
directo, con control negativo vía SQL crudo.

**Tech Stack:** TypeScript, vitest, Supabase (Postgres + RLS + PostgREST),
`@supabase/supabase-js`.

## Alcance

**Dentro:** tsconfig + script `typecheck` de `packages/core`; un test e2e
nuevo (`aislamiento-rls.e2e.test.ts`) con control negativo.

**Fuera:** scoping de `reporteria` por `empresa_id` (plan propio, es del
tamaño de un módulo completo); fase 2 (originacion/cartera/contabilidad/
catalogo/agenda).

## Global Constraints

- TypeScript estricto, sin `any` sin justificar.
- Comandos pnpm siempre desde la raíz del repo.
- `psql` no está en PATH directo — usar
  `docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -c "..."`.
- Local Supabase ya corre — no reinstalar ni reiniciar nada salvo que
  `pnpm supabase status` muestre que está caído.
- Para tests e2e, exportar las llaves desde `apps/backoffice/.env.local`:
  `export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)`
  `export SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/backoffice/.env.local | cut -d= -f2)`
- Commits: en esta ejecución (subagent-driven-development, worktree
  aislado) los subagentes SÍ hacen `git commit` real — excepción ya
  confirmada por Julián para este flujo, no aplica fuera de él.

---

### Task 1: `packages/core/tsconfig.json` + script `typecheck`

**Files:**
- Create: `packages/core/tsconfig.json`
- Modify: `packages/core/package.json`

**Interfaces:**
- Produces: comando `pnpm --filter @sumo/core typecheck`, que la Tarea 3
  usa como parte de la verificación final.

- [ ] **Step 1: Crear el tsconfig**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Agregar el script al package.json**

En `packages/core/package.json`, el bloque `"scripts"` pasa de:

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "vitest run --config vitest.e2e.config.ts"
  },
```

a:

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "typecheck": "tsc --noEmit"
  },
```

- [ ] **Step 3: Correr el typecheck y arreglar lo que aparezca**

Run: `pnpm --filter @sumo/core typecheck`

Este es el primer typecheck REAL que corre sobre `packages/core` — es
esperable que aparezcan errores que hoy nadie detecta (el propio
`flow.e2e.test.ts` se rompió así en la fase 1 anterior). Si aparecen:
arreglar cada uno en el archivo real que lo tiene (nunca silenciar con
`// @ts-ignore` ni relajar `strict`). Si la lista es larga o toca
código fuera del alcance de esta tarea (ej. un módulo entero mal
tipado), STOP y reporta BLOCKED con la lista completa de errores — no
los arregles todos por tu cuenta sin visibilidad del controller, dado
que podrían ser síntoma de algo más grande.

Expected tras arreglar: `pnpm --filter @sumo/core typecheck` sale limpio,
sin output, exit code 0.

- [ ] **Step 4: Verificar que la suite unitaria sigue en verde**

Run: `pnpm --filter @sumo/core test`
Expected: 138/138 passing (el typecheck no cambia comportamiento en
runtime, solo tipos — si algo se rompió aquí, algo salió mal en el Step 3).

- [ ] **Step 5: Commit**

```bash
git add packages/core/tsconfig.json packages/core/package.json
git commit -m "chore(core): typecheck real con tsconfig.json propio"
```

(Si el Step 3 requirió arreglar archivos fuente reales, agrégalos también
al mismo commit o a uno separado con mensaje que describa el fix.)

---

### Task 2: Test de aislamiento a nivel RLS (con control negativo)

**Files:**
- Create: `packages/core/aislamiento-rls.e2e.test.ts`

**Interfaces:**
- Consumes: `@supabase/supabase-js` `createClient` (llave `service_role`
  para el fixture, llave `anon` para la aserción real); usuario del seed
  `vendedor@sumoto.co` / `sumoto123` (tienda
  `11111111-1111-4111-8111-111111111111`, empresa
  `d0000000-0000-4000-8000-000000000001`).

- [ ] **Step 1: Escribir el test**

```typescript
// Aislamiento entre tenants a nivel de POLÍTICA RLS (no del repositorio —
// ver aislamiento-tenant.e2e.test.ts para eso). Este test usa la llave
// anon + login real (signInWithPassword), el mismo camino que usa
// producción (proxy.ts / lib/auth.ts) — no es un atajo de prueba.
// Se corre manualmente: npx vitest run aislamiento-rls.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL_SUPABASE = "http://127.0.0.1:54321";

const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const SUFIJO = Date.now().toString(36); // único por corrida, para slug (sí admite letras)
const CEDULA_RIVAL = `20${Date.now().toString().slice(-8)}`; // 10 dígitos, solo numérico (formato cédula real)

describe("aislamiento entre empresas — política RLS (usuario autenticado real)", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let clienteRival: string;

  beforeAll(async () => {
    const { data: empresa, error: errEmpresa } = await admin
      .from("empresas")
      .insert({ nombre: "Rival RLS S.A.S.", slug: `rival-rls-${SUFIJO}` })
      .select("id")
      .single();
    if (errEmpresa) throw errEmpresa;
    empresaRival = empresa.id;

    const { data: tienda, error: errTienda } = await admin
      .from("tiendas")
      .insert({ nombre: "Rival RLS Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    if (errTienda) throw errTienda;
    tiendaRival = tienda.id;

    const { data: cliente, error: errCliente } = await admin
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: CEDULA_RIVAL,
        nombres: "Roberto",
        apellidos: "RLS-Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();
    if (errCliente) throw errCliente;
    clienteRival = cliente.id;
  });

  it("un vendedor autenticado de SUMOTO nunca ve al cliente de la empresa rival vía RLS", async () => {
    const anon = createClient(URL_SUPABASE, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: errLogin } = await anon.auth.signInWithPassword({
      email: "vendedor@sumoto.co",
      password: "sumoto123",
    });
    expect(errLogin).toBeNull();

    const { data: porId } = await anon
      .schema("clientes")
      .from("clientes")
      .select("id")
      .eq("id", clienteRival)
      .maybeSingle();
    expect(porId).toBeNull();

    const { data: porCedula } = await anon
      .schema("clientes")
      .from("clientes")
      .select("id")
      .eq("cedula", CEDULA_RIVAL)
      .maybeSingle();
    expect(porCedula).toBeNull();

    const { data: tiendasVisibles } = await anon.from("tiendas").select("id");
    expect(tiendasVisibles?.some((t) => t.id === tiendaRival)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que pasa**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
export SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core exec vitest run aislamiento-rls.e2e.test.ts --config vitest.e2e.config.ts
```
Expected: PASS.

- [ ] **Step 3: Control negativo — desactivar RLS, confirmar que el test SÍ falla**

```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -c \
  "alter table clientes.clientes disable row level security;"
```

Correr el mismo comando del Step 2 de nuevo. Expected: FAIL — el cliente
rival aparece (RLS desactivada = sin protección). Esto es la prueba de
que el test realmente detecta lo que dice detectar, no que pasa por
casualidad.

- [ ] **Step 4: Reactivar RLS y confirmar que el test vuelve a pasar**

```bash
docker exec supabase_db_SUMOTO-PROJECT psql -U postgres -c \
  "alter table clientes.clientes enable row level security;"
```

Correr el comando del Step 2 una tercera vez. Expected: PASS de nuevo.
Documentar las 3 corridas (pasa / falla con RLS desactivada / vuelve a
pasar) en el reporte — es la evidencia de control negativo.

- [ ] **Step 5: Commit**

```bash
git add packages/core/aislamiento-rls.e2e.test.ts
git commit -m "test(seguridad): aislamiento entre empresas a nivel de política RLS"
```

---

### Task 3: Verificación final

**Files:** ninguno nuevo — solo comandos de verificación y actualización
de `docs/STATUS.md`.

- [ ] **Step 1: Typecheck limpio**

Run: `pnpm --filter @sumo/core typecheck`
Expected: sin output, exit 0.

- [ ] **Step 2: Suite unitaria completa**

Run: `pnpm --filter @sumo/core test`
Expected: 138/138 passing.

- [ ] **Step 3: Suite e2e completa (los 3 archivos)**

Run:
```bash
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY apps/backoffice/.env.local | cut -d= -f2)
export SUPABASE_ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY apps/backoffice/.env.local | cut -d= -f2)
pnpm --filter @sumo/core test:e2e
```
Expected: `flow.e2e.test.ts` + `aislamiento-tenant.e2e.test.ts` +
`aislamiento-rls.e2e.test.ts`, todos pasando.

- [ ] **Step 4: Actualizar `docs/STATUS.md`**

Mover el ítem "Deuda técnica detectada en revisión final" (agregado en
la fase 1) — marcar como resuelto el punto del tsconfig/typecheck y el
punto del test RLS. Dejar explícito que `reporteria` sigue pendiente
(plan propio). Agregar entrada de bitácora fechada resumiendo lo hecho.

- [ ] **Step 5: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): typecheck del core y test RLS cierran deuda técnica de fase 1"
```

## Self-Review

**Cobertura de la spec:** secciones 4.1 (tsconfig+typecheck) y 4.2 (test
RLS) cubiertas por las Tareas 1 y 2 respectivamente; sección 5
(verificación) por la Tarea 3.

**Placeholders:** ninguno — código completo en cada paso.

**Consistencia de tipos:** `SUFIJO` (base36, para el `slug` de la empresa
rival) y `CEDULA_RIVAL` (numérico puro, 10 dígitos) se generan por
separado a propósito — mismo patrón de no-colisión que
`aislamiento-tenant.e2e.test.ts` de la fase 1, pero la cédula mantiene el
formato solo-dígitos del resto del seed (corregido en autorevisión: la
primera versión reutilizaba el `SUFIJO` base36 para la cédula, lo que
podía colar letras donde el dominio real nunca las tendría).
