# SUMOTO-PROJECT — Sistema de Originación y Administración de Cartera de Créditos

## Qué es este proyecto

Sistema de crédito para SUMOTO (retail de motos, Colombia): originación de créditos
con decisión en ~5 minutos, administración de cartera, contabilidad automática y reportes.
Cliente potencial en fase de demo. El desarrollador es Julián Núñez (full stack, 4 años,
+ 10 años de experiencia en banca comercial — conoce el dominio de crédito por dentro).

**Objetivo inmediato:** demo funcional del flujo estrella (solicitud → consulta riesgo →
decisión automática → crédito con plan de cuotas → dashboard de cartera + asientos contables).

## Arquitectura (decisiones YA tomadas — no reabrir sin discutirlo con Julián)

**Monolito modular con fronteras DDD, inspirado en Medusa v2.** NO microservicios.
Las fronteras entre módulos son lógicas (imports prohibidos, eventos), no físicas.
Diseñado para poder extraer módulos a servicios en el futuro sin reescribir.

### Kernel (packages/core/kernel/) — YA IMPLEMENTADO, no modificar sin razón fuerte
- `container.ts` — DI con node-dependency-injection. Tokens centralizados en TOKENS.
- `event-bus.ts` — pub/sub en memoria. Convención de eventos: `modulo.entidad.hecho`
  (en pasado: "cartera.pago.registrado"). Un manejador que falla NO tumba al emisor.
- `module-def.ts` + `module-loader.ts` — contrato ModuleDefinition y arranque en dos
  pasadas (1: registrar todos, 2: suscribir oídos).
- `workflow.ts` — saga con compensación para operaciones multi-módulo (ej: desembolso).

### Módulos (packages/core/modules/) — anatomía obligatoria de cada uno
```
modules/<nombre>/
├── domain/          # entidades, reglas, contratos (TS PURO — cero imports externos)
├── application/     # casos de uso (orquestan; no saben CÓMO se persiste)
├── infrastructure/  # repositorios Supabase, mappers
├── subscribers/     # oídos: reaccionan a eventos de otros módulos
├── module.ts        # ModuleDefinition: registrar() + suscripciones()
└── index.ts         # ÚNICA puerta importable desde fuera del módulo
```
Módulos: `clientes`, `originacion`, `cartera`, `contabilidad`, `reporteria` (reporteria
es solo lectura: queries sobre vistas, sin domain).

### Integraciones (packages/core/integrations/)
Patrón adaptador SIEMPRE: interfaz en el dominio, implementaciones intercambiables vía DI.
- `experian/` — consulta de riesgo. HOY: mock. Token DI: `integracion.riesgo`.
- `identidad/` — escáner de cédula (tercero, patrón por confirmar: síncrono o webhook).
  HOY: mock + EntradaManual. Token: `integracion.identidad`.
- `world-office/` — asientos contables. HOY: mock. Token: `integracion.contable`.
El formato externo (JSON de Experian, etc.) MUERE en el adaptador. Adentro solo circulan
tipos del dominio (ReporteRiesgo, DatosCiudadano, AsientoContable).

### Apps
- `apps/backoffice` — Next.js 16 App Router. Route groups por rol: (auth), (vendedor),
  (manager), (financiero), (contable), (ceo). middleware.ts = guarda de roles.
  Fin de semana: solo (auth), (vendedor) y un (financiero) mínimo.
- `apps/portal-cliente` — NO EXISTE AÚN. Fase futura. No crear.

### Base de datos (supabase/)
- Supabase local vía CLI (`pnpm supabase start`). Studio: 127.0.0.1:54323. API: 54321.
- UN SCHEMA POR MÓDULO: `clientes`, `originacion`, `cartera`, `contabilidad`.
- Entre módulos NO hay foreign keys cruzadas: tablas de enlace en schema `links`
  (patrón Module Links de Medusa v2).
- Todo cambio de DB = migración versionada (`pnpm supabase migration new <nombre>`).
  PROHIBIDO configurar por clicks en Studio: el repo es la verdad, Studio es la ventana.
- RLS por rol/tienda en todas las tablas con datos de negocio. Tabla `perfiles`
  (user_id → rol → tienda_id) es la base del middleware y de las políticas.
- `perfiles` y `tiendas` viven en el schema `public` (decisión 2026-07-11): son
  transversales (seguridad y estructura organizacional), no pertenecen a ningún
  módulo. Ahí también las funciones helper de RLS (`rol_actual()`, `tienda_actual()`).
  FKs desde schemas de módulo hacia `public` SÍ se permiten (la prohibición de FKs
  cruzadas es ENTRE módulos); entre módulos, tablas de enlace en schema `links`.

## Reglas de conexión (LA CONSTITUCIÓN — verificar en cada PR/commit)

1. Las apps NUNCA contienen lógica de negocio. Pantallas y rutas API: reciben → llaman
   caso de uso del core → responden. Un cálculo de mora en un componente React es un bug.
2. Un módulo solo se importa por su `index.ts`. Nunca meter la mano dentro de otro módulo.
3. Entre módulos: solo eventos (bus) o resolución por container. Nunca imports directos
   entre domains, nunca FKs cruzadas entre schemas.
4. El dominio no importa NADA externo (ni supabase-js, ni fetch, ni next). TS puro.
5. Todo lo externo entra traducido por su adaptador.
6. Seguridad en dos puertas: middleware (pantallas) + RLS (filas). Ambas siempre.
7. Nombres del dominio EN ESPAÑOL (Credito, Cuota, registrarPago, evaluarSolicitud) —
   es el idioma del negocio y del cliente. Infraestructura/técnico en inglés está bien.

## Principios de calidad (aplicar SIEMPRE, señalar violaciones al proponerlas)

- **S**RP: un caso de uso = una acción de negocio. Entidades sin lógica de persistencia.
- **O**CP: nuevas fuentes de identidad / consultores de riesgo = nueva implementación
  del contrato, no modificación del existente.
- **L**SP: todo mock debe ser sustituible por la implementación real sin cambiar consumidores.
- **I**SP: contratos pequeños (FuenteIdentidad.capturar, ConsultorRiesgo.consultar) —
  no interfaces gordas.
- **D**IP: dominio define contratos; infraestructura los implementa. La flecha de
  dependencia SIEMPRE apunta hacia el dominio.
- Errores como valores donde aporte (Result/either en decisiones de negocio);
  excepciones solo para lo excepcional.
- Dinero: NUNCA float. Usar enteros en centavos o decimal strings + utilidades en
  shared/kernel (value object Money pendiente de crear).
- Tests: mínimo, unit tests del motor de decisión y del reparto de pagos
  (mora → interés → capital). Son el corazón del negocio.

## Convenciones

- pnpm workspaces. Comandos desde la RAÍZ: `pnpm --filter backoffice dev`,
  `pnpm supabase <cmd>`.
- Commits: convencionales en español — `feat(originacion): motor de decisión`,
  `fix(cartera): cálculo de mora`. Pequeños y frecuentes. Rama: main directo
  (fin de semana, dev solo). GitHub Flow cuando haya contrato.
- TypeScript estricto. Sin `any` salvo justificación en comentario.
- UI: Tailwind. Componentes en el backoffice por ahora (packages/ui es fase futura).

## Flujo de negocio de referencia (para entender el dominio)

1. Vendedor llena solicitud (cliente + moto + plazo + cuota inicial). Datos del cliente
   pueden venir del escáner de cédula (tercero) o entrada manual — mismo contrato.
2. Sistema consulta riesgo (Experian, hoy mock) → JSON con score, moras, endeudamiento.
3. Motor de decisión (reglas parametrizables en producto_credito.reglas_decision JSONB):
   cuota ≤ 30-35% ingreso, score mínimo, LTV. Resultado: APROBADO / NEGADO / REVISION_MANUAL
   con razones visibles (explicabilidad = requisito).
4. Desembolso (workflow con compensación): solicitud aprobada → crédito + plan de cuotas
   (amortización francesa, tasa EA→mensual) → evento credito.desembolsado.
5. Vida del crédito: pagos se reparten mora → interés → capital vía tabla aplicacion_pago
   (un pago puede cubrir varias cuotas). Mora se calcula por días vencidos.
6. Contabilidad escucha eventos y genera asientos (desembolso: DB cartera/CR bancos;
   pago: DB bancos/CR cartera + ingreso intereses). Se despachan a World Office (adaptador).
7. Reportes: saldo cartera, mora por franjas (0-30/31-60/61-90/+90), ICV, recaudo vs
   esperado. Vistas materializadas en Postgres.

## Estado y memoria

- Estado actual y próximos pasos: **docs/STATUS.md** — LEERLO AL INICIAR CADA SESIÓN
  y ACTUALIZARLO AL TERMINAR (qué se hizo, qué quedó a medias, decisiones tomadas).
- Estructura del monorepo, topología de despliegue y patrones Medusa v2:
  **docs/ARCHITECTURE.md**.
- Decisiones de arquitectura nuevas: agregarlas a este archivo, sección Arquitectura.
- Si algo del contexto contradice el código real, el código manda — y se corrige aquí.