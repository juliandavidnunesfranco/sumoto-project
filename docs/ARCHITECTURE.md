# ARQUITECTURA — SUMOTO-PROJECT

> Complemento de `CLAUDE.md` (reglas y principios). Este documento fija la
> estructura física del monorepo, la topología de despliegue y los patrones
> estilo Medusa v2 que el kernel replica. Si algo aquí contradice el código,
> el código manda y se corrige aquí.

## Estructura del monorepo

```
sumoto-credit/
├── apps/
│   ├── backoffice/                  # App 1: los 5 roles internos
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (vendedor)/          # simulador, solicitudes
│   │   │   ├── (manager)/           # aprobaciones, mi tienda
│   │   │   ├── (financiero)/        # cartera, mora, proyecciones
│   │   │   ├── (contable)/          # asientos, conciliación, World Office
│   │   │   ├── (ceo)/               # tablero ejecutivo
│   │   │   └── api/                 # rutas API → llaman casos de uso, cero lógica
│   │   └── middleware.ts            # guarda de roles: decide quién entra a qué grupo
│   │
│   └── portal-cliente/              # App 2: pública, superficie mínima (FASE FUTURA)
│       └── app/
│           ├── mi-credito/
│           ├── pagar/
│           └── api/                 # solo endpoints de lectura + pago
│
├── packages/
│   ├── core/                        # EL NEGOCIO — no sabe que existen las apps
│   │   ├── kernel/                  # container (DI), event-bus, loader, workflows
│   │   ├── modules/
│   │   │   ├── originacion/
│   │   │   │   ├── domain/          # entidades, reglas, contratos (TS puro)
│   │   │   │   ├── application/     # casos de uso
│   │   │   │   ├── infrastructure/  # repos Supabase
│   │   │   │   ├── subscribers/     # oídos a eventos de otros módulos
│   │   │   │   ├── module.ts        # ModuleDefinition: registrar() + suscripciones()
│   │   │   │   └── index.ts         # ÚNICA puerta importable del módulo
│   │   │   ├── cartera/             # (misma anatomía)
│   │   │   ├── contabilidad/        # (misma anatomía)
│   │   │   ├── clientes/            # (misma anatomía)
│   │   │   └── reporteria/          # solo queries sobre vistas, sin domain
│   │   └── integrations/
│   │       ├── experian/            # interfaz + mock + real (traduce el JSON)
│   │       ├── identidad/           # escáner de cédula (mock + entrada manual)
│   │       ├── world-office/        # adaptador de asientos
│   │       └── pagos/               # pasarela de pagos (fase portal-cliente)
│   │
│   ├── ui/                          # design system compartido (FASE FUTURA)
│   └── contracts/                   # tipos/DTOs compartidos entre apps y core
│
└── supabase/
    └── migrations/                  # un schema por módulo + schema links
```

## Topología de despliegue en producción (distribuida y escalable)

En desarrollo todo corre junto (monolito modular). En producción cada pieza se
despliega como contenedor independiente; las fronteras lógicas del monorepo son
exactamente los cortes de despliegue — por eso se prohíben los imports cruzados:

```
┌─────────────────────┐   ┌──────────────────────────┐
│  Contenedor 1        │   │  Contenedor 2             │
│  apps/backoffice     │   │  apps/portal-cliente      │
│  (5 roles internos,  │   │  (endpoint público,       │
│   red privada/VPN)   │   │   superficie mínima)      │
└──────────┬───────────┘   └────────────┬──────────────┘
           │        llaman casos de uso │ (HTTP interno / SDK)
           ▼                            ▼
┌──────────────────────────────────────────────────────┐
│  Contenedor 3 — CORE                                  │
│  packages/core: kernel + módulos + adaptadores        │
│  (container DI, event-bus, workflows, subscribers)    │
└──────────┬────────────────────────────┬──────────────┘
           │ SQL / RLS                  │ adaptadores
           ▼                            ▼
┌─────────────────────┐   ┌──────────────────────────┐
│  Contenedor 4        │   │  Contenedor 5 — EXTERNOS  │
│  Supabase            │   │  Experian, World Office,  │
│  (Postgres, Auth,    │   │  escáner de cédula,       │
│   schemas por módulo)│   │  pasarela de pagos        │
└─────────────────────┘   └──────────────────────────┘
```

Reglas que hacen posible esta separación sin reescribir:

- Las apps NUNCA tocan la DB de negocio directo: pasan por casos de uso del core.
- El core no importa nada de las apps (la flecha va apps → core, jamás al revés).
- Los externos entran solo por adaptadores: cambiar mock → real es cambiar el
  binding en el container, cero cambios en dominio.
- Sin FKs entre schemas: cada módulo podría llevarse su schema a otra base.

## La figura Medusa v2 que replicamos

El kernel (`packages/core/kernel/`) es una versión mínima del framework de
módulos de Medusa v2. Los conceptos y su equivalente aquí:

### 1. Módulos aislados con puerta única
Cada módulo es una caja negra: expone servicios/casos de uso por `index.ts` y se
registra en el container vía `module.ts` (`ModuleDefinition`). Nadie mete la mano
adentro de otro módulo. El `module-loader.ts` arranca en dos pasadas: (1) todos
se registran en el container, (2) se conectan las suscripciones — así los módulos
pueden resolverse entre sí sin importar el orden.

### 2. Module Links: ligar módulos por tabla, no por FK
Como en Medusa v2, las relaciones entre módulos NO son foreign keys cruzadas.
Son tablas de enlace en el schema `links`:

```sql
-- ejemplo: qué crédito nació de qué solicitud
create table links.solicitud_credito (
  solicitud_id uuid not null,  -- vive en schema originacion (sin FK)
  credito_id   uuid not null,  -- vive en schema cartera (sin FK)
  creado_en    timestamptz default now(),
  primary key (solicitud_id, credito_id)
);
```

Beneficio: un módulo puede extraerse (otra base, otro servicio) sin romper
integridad referencial de otros. La consistencia la garantizan los workflows.

### 3. Workflows con compensación (sagas)
Operaciones que tocan varios módulos se modelan en `workflow.ts`: una lista de
pasos, cada uno con su función creadora (`invocar`) y su compensación
(`compensar`) para revertir. Si el paso N falla, se deshacen N-1..1 en orden
inverso. Ejemplo canónico: `desembolsarCredito` (crear crédito → generar plan de
cuotas → marcar solicitud desembolsada → emitir `credito.desembolsado`).

### 4. Eventos y subscribers
El `event-bus.ts` es pub/sub en memoria. Convención: `modulo.entidad.hecho` en
pasado (`cartera.pago.registrado`). Los módulos reaccionan a hechos de otros vía
`subscribers/` (declarados en `module.ts → suscripciones()`). Un subscriber que
falla NO tumba al emisor. Futuro: outbox persistente + reintentos.

### 5. Hooks y webhooks (futuro)
- **Hooks:** puntos de extensión dentro de workflows/casos de uso del core para
  que implementaciones futuras inyecten lógica sin modificar el módulo (OCP).
  Se implementarán como pasos opcionales resueltos por container cuando haga falta
  el primer caso real — no antes.
- **Webhooks:** entrada asíncrona de externos (escáner de cédula, pasarela de
  pagos). Entran por una ruta API delgada → adaptador traduce el payload →
  caso de uso. El formato externo muere en el adaptador.

### 6. Cómo se crea un módulo nuevo (receta)
1. `packages/core/modules/<nombre>/` con la anatomía obligatoria
   (domain/application/infrastructure/subscribers/module.ts/index.ts).
2. Migración: `pnpm supabase migration new <nombre>_schema` → schema propio,
   tablas con RLS por rol/tienda, links en schema `links` si se relaciona con otros.
3. Token(s) del módulo en `kernel/container.ts → TOKENS`.
4. `module.ts`: `registrar()` anota servicios en el container; `suscripciones()`
   declara sus oídos.
5. Registrar el módulo en el arranque (`arrancarKernel([...modulos])`).
6. Tests unitarios de la lógica de negocio crítica.

## Estado de implementación

Ver `STATUS.md`. Hoy existen: kernel completo, `apps/backoffice` (esqueleto
Next.js 16), Supabase local, `packages/contracts` (placeholder). Los módulos,
integraciones, `packages/ui` y `apps/portal-cliente` se construyen por fases.
