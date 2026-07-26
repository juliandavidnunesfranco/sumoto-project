# Diseño: typecheck real de `packages/core` + test de aislamiento a nivel RLS

- Fecha: 2026-07-25
- Estado: aprobado por Julián, pendiente de plan de implementación
- Contexto: deuda técnica detectada en el review final de la fase 1 de
  multi-tenencia (`docs/superpowers/plans/
  2026-07-25-empresas-tenencia-fundacional.md`), separada de esa fase
  porque no bloqueaba su merge pero sí debe cerrarse antes de replicar el
  patrón `empresa_id` en los 5 módulos restantes (fase 2).

## 1. Por qué esto importa

Durante la fase 1, `packages/core/flow.e2e.test.ts` (un archivo
preexistente) se rompió porque una tarea volvió `empresaId` obligatorio
en `ComandoRegistrarCliente`, y nada lo detectó hasta que el test corrió
en la verificación final. La causa raíz: `packages/core` no tiene
`tsconfig.json` propio, así que `tsc --noEmit` ahí no compila nada real —
ningún gate del repo typechequea sus archivos de test. Con 5 módulos más
por migrar en fase 2, este mismo patrón de fuga puede repetirse 5 veces
si no se cierra antes.

Por separado, la suite de aislamiento entre tenants
(`aislamiento-tenant.e2e.test.ts`) prueba el filtro `empresa_id` a nivel
de repositorio — pero el core corre con `service_role`, que bypassa RLS
por completo. La otra puerta (las políticas RLS mismas, la que protege a
un usuario real autenticado) no tiene ninguna prueba automatizada.

## 2. Alcance

**Dentro:**
1. `packages/core/tsconfig.json` + script `typecheck`, cubriendo TODO
   `.ts` del core incluidos `*.test.ts`/`*.e2e.test.ts`.
2. Un test e2e nuevo que autentica con la llave anon (`signInWithPassword`,
   camino real de producción — ver aclaración de arquitectura abajo) y
   confirma que las políticas RLS por sí solas bloquean el cruce entre
   empresas, con control negativo (desactivar RLS temporalmente, confirmar
   que el test falla, reactivar).

**Fuera:** el scoping de `reporteria` por `empresa_id` (resultó ser del
tamaño de un módulo completo de fase 2 — plan propio, separado) y
cualquier parte de la fase 2 (originacion/cartera/contabilidad/catalogo/
agenda).

## 3. Aclaración de arquitectura (para que quede registrada, no solo dicha)

Llave anon (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, credencial pública de
instanciación del cliente) y rol `anon` de Postgres/RLS (asignado cuando
el JWT de la sesión no corresponde a un usuario autenticado) son cosas
distintas. En producción, `proxy.ts` y `lib/auth.ts` YA construyen su
cliente con la llave anon (decisión ya documentada en CLAUDE.md — auth es
plumbing de la app, no del kernel); tras un `signInWithPassword` exitoso,
esa misma sesión trae un JWT con `role: authenticated`, que es lo que
PostgREST lee para aplicar las políticas `for select to authenticated`.
`service_role` es una llave aparte, solo la usa el core para operaciones
de negocio vía kernel, nunca para login. El test de este diseño reproduce
el camino real de producción tal cual — no es un atajo de prueba.

## 4. Diseño

### 4.1 `packages/core/tsconfig.json` + script `typecheck`

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

En `packages/core/package.json`, agregar:

```json
"typecheck": "tsc --noEmit"
```

junto a los scripts `test`/`test:watch`/`test:e2e` ya existentes. Correr
`pnpm --filter @sumo/core typecheck` contra el código actual del core
(post-fase-1) y corregir cualquier error real que aparezca — no se asume
que estará limpio, se verifica.

### 4.2 Test de aislamiento a nivel RLS

Nuevo archivo: `packages/core/aislamiento-rls.e2e.test.ts` (nombre
distinto de `aislamiento-tenant.e2e.test.ts` — ese prueba el filtro del
repositorio, este prueba la política RLS misma; ambos coexisten, no se
reemplazan).

Estructura:
1. `beforeAll`: mismo patrón de fixture que `aislamiento-tenant.e2e.test.ts`
   — insertar una empresa rival + tienda + cliente vía `service_role`
   (bypassa RLS a propósito, es solo el fixture).
2. Cliente Supabase construido con la llave **anon**
   (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, la misma variable que usa
   `apps/backoffice/.env.local`), autenticado vía
   `supabase.auth.signInWithPassword({ email: "vendedor@sumoto.co",
   password: "sumoto123" })` — usuario real del seed, no un usuario
   nuevo creado para el test.
3. Con esa sesión autenticada, consultar DIRECTO `clientes.clientes` y
   `public.tiendas` (vía `.schema("clientes").from("clientes")` /
   `.from("tiendas")`, sin pasar por `ClientesService` ni por ningún caso
   de uso del core) y confirmar que CERO filas de la empresa rival
   aparecen — ni por `buscar`, ni por `select` directo del cliente rival
   por id/cédula si se conoce.
4. Control negativo: antes de dar el test por bueno, desactivar RLS de
   `clientes.clientes` con SQL directo
   (`alter table clientes.clientes disable row level security;`, vía
   `docker exec supabase_db_SUMOTO-PROJECT psql` o el cliente
   `service_role`), correr el test, confirmar que FALLA (el cliente rival
   aparece), reactivar RLS
   (`alter table clientes.clientes enable row level security;`), correr
   de nuevo, confirmar que vuelve a pasar. Documentar ambas corridas como
   evidencia, igual que se hizo en la fase 1 con el repositorio.

**Alcance del control negativo:** solo `clientes.clientes` (no las 2
tablas de `public`) — es suficiente para probar que el mecanismo
funciona; duplicarlo en `tiendas` sería redundante para este test
puntual.

## 5. Testing / verificación

- `pnpm --filter @sumo/core typecheck` limpio.
- `pnpm --filter @sumo/core test` — 138/138 sigue en verde (no se toca
  lógica de negocio).
- El nuevo test e2e pasa, con evidencia de control negativo documentada.
- Suite completa de e2e (`pnpm --filter @sumo/core test:e2e`) sigue
  incluyendo `flow.e2e.test.ts` + `aislamiento-tenant.e2e.test.ts` +
  el nuevo `aislamiento-rls.e2e.test.ts`, todos en verde.

## 6. Próximos pasos

Spec cubre un alcance chico y acotado — pasa directo a
`superpowers:writing-plans` para un solo plan (no requiere descomponerse
en sub-proyectos). Después de esto: plan propio para `reporteria` +
`empresa_id` (tamaño de módulo completo), luego fase 2
(originacion/cartera/contabilidad/catalogo/agenda).
