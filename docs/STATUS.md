# ESTADO DEL PROYECTO — SUMOTO

> Claude Code: lee este archivo al iniciar cada sesión. Actualízalo al terminar:
> mueve lo completado a "Hecho", actualiza "En curso" y "Siguiente", registra
> decisiones en la bitácora. Es la memoria de continuidad del proyecto.

## Meta inmediata
Demo funcional para presentar a SUMOTO: flujo solicitud → decisión en minutos →
crédito con cuotas → dashboard cartera + asientos contables. Branding SUMOTO.

## Hecho ✅
- [x] Monorepo pnpm workspaces (apps/, packages/, supabase/)
- [x] apps/backoffice creado (Next.js 16 App Router + Tailwind)
- [x] Supabase local corriendo (CLI + Docker). Llaves en apps/backoffice/.env.local
- [x] Git + GitHub (repo privado sumoto-project, rama main)
- [x] Kernel completo en packages/core/kernel/: container.ts, event-bus.ts,
      module-def.ts, module-loader.ts, workflow.ts (+ index.ts reexportando)
- [x] Saneamiento del monorepo (2026-07-11): eliminado workspace/lockfile anidado
      en apps/backoffice; @sumo/core consumible (main/exports → kernel/index.ts +
      transpilePackages en next.config); vitest en core con 4 tests del kernel
      pasando; typecheck backoffice→core verificado
- [x] CLAUDE.md movido a la raíz del repo (auto-carga por sesión); referencia
      ESTADO.md corregida a STATUS.md
- [x] docs/ARCHITECTURE.md: estructura, topología de 5 contenedores, patrones
      Medusa v2 (links, workflows, subscribers, hooks) y receta de módulo nuevo
- [x] Subagentes del proyecto en .claude/agents/: arquitecto-revisor, dev-dominio,
      dev-datos, dev-ui

## En curso 🔨 (jornada sábado 2026-07-11)
- [ ] Módulo `clientes` (cada numeral = una unidad commiteable):
  - [x] 1. Migración SQL: schema clientes (tabla clientes, dinero en bigint
        centavos), tiendas, perfiles (user→rol→tienda, enum 5 roles), RLS por
        rol/tienda. Verificado: db reset limpio + 6 políticas en pg_policies.
        Schema clientes expuesto en api.schemas (config.toml).
  - [x] 2. Dominio: tipo DatosCiudadano, entidad Cliente, contratos
        FuenteIdentidad y RepositorioClientes (TS puro).
        ⚠ PENDIENTE: reglas de validarParaRegistro en domain/client.ts (las
        escribe Julián con criterio bancario; hoy acepta todo)
  - [x] 3. integrations/identidad: EscanerCedulaMock + EntradaManual
  - [x] 4. Caso de uso RegistrarCliente (idempotente por cédula, emite
        clientes.cliente.registrado) + 4 unit tests con fakes
  - [x] 5. Infraestructura: RepositorioClientesSupabase + mapper
  - [x] 6. module.ts + index.ts + bootstrap arrancarNucleo() (idempotente);
        @sumo/core ahora exporta desde index.ts raíz (kernel + módulos).
        Kernel: agregados result.ts (Resultado/exito/fallo) y token infra.supabase

## Siguiente (en orden) 📋
1. Módulo `originacion`: producto_credito (reglas JSONB), solicitud, decision,
   motor de decisión (servicio de dominio + unit tests), caso de uso evaluarSolicitud,
   mock Experian en integrations/experian
2. Módulo `cartera`: credito, cuota, pago, aplicacion_pago; generación plan de pagos
   (amortización francesa); workflow desembolsarCredito; caso de uso registrarPago
   (reparto mora→interés→capital) + unit tests
3. Módulo `contabilidad`: subscribers a credito.desembolsado y cartera.pago.registrado;
   tabla asientos; adaptador mock World Office
4. Backoffice: (auth) login + middleware por rol + tabla perfiles seed;
   (vendedor) formulario solicitud con botón "Escanear cédula" (mock) + simulador +
   pantalla resultado decisión; (financiero) dashboard cartera básico
5. Seed de demo: productos de crédito, usuarios por rol, 15-20 créditos con historia
   de pagos variada (al día, mora 30, mora 60+) para que el dashboard luzca
6. Branding SUMOTO en la UI + recorrido de demo ensayado

## Fuera de alcance del fin de semana (fases del contrato — NO construir aún)
- portal-cliente, roles (manager)(contable)(ceo) completos, packages/ui
- Integraciones reales: Experian, World Office (falta saber versión/API), escáner
  del tercero (falta doc: ¿síncrono o webhook?)
- Outbox persistente del event bus, ML de scoring, PDF417 en navegador (bonus si sobra tiempo)

## Preguntas abiertas para SUMOTO 📌
- ¿Proveedor del escáner de cédula? ¿API síncrona o webhook? ¿Documentación?
- ¿Versión de World Office? (¿cloud con API o escritorio con importación de archivos?)
- ¿Figura de contratación y presupuesto? (Julián: retainer prestación de servicios
  por fases; rango COP $7–10M/mes; PI del core reutilizable a negociar)

## Bitácora de decisiones 📓
- 2026-07-11: Monolito modular estilo Medusa v2 (kernel DI + eventos + links), NO
  microservicios. Next.js para la demo; NestJS se evalúa solo si el proyecto escala.
- 2026-07-11: Schemas por módulo, links sin FK cruzadas, RLS por rol/tienda.
- 2026-07-11: Integraciones siempre tras adaptador con mock intercambiable (DI).
- 2026-07-11 (sábado): CLAUDE.md vive en la RAÍZ del repo (no en docs/) para que
  Claude Code lo cargue automático cada sesión. docs/ queda con STATUS.md y
  ARCHITECTURE.md.
- 2026-07-11 (sábado): @sumo/core se consume como TS sin compilar: exports apuntan
  a kernel/index.ts y el backoffice lo transpila vía transpilePackages. Sin build
  step mientras dure la demo.
- 2026-07-11 (sábado): vitest como test runner del core (esbuild aprobado en
  pnpm-workspace onlyBuiltDependencies). Tests junto al código (*.test.ts).
- 2026-07-11 (sábado): `perfiles` y `tiendas` en schema `public` (transversales:
  seguridad + organización), con helpers RLS `rol_actual()` / `tienda_actual()`.
  FKs módulo→public permitidas; la prohibición de FKs cruzadas es entre módulos.
- (agregar nuevas decisiones aquí con fecha)