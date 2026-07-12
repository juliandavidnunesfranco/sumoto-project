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
- [x] Módulo `clientes` COMPLETO (2026-07-11): migración con RLS verificada,
      dominio puro (validarParaRegistro con reglas bancarias de Julián +
      predicados esCedulaValida/esMayorDeEdad exportados para Zod/contracts),
      EscanerCedulaMock + EntradaManual, caso de uso RegistrarCliente idempotente,
      repo Supabase, module.ts. 25 tests.
- [x] Módulo `originacion` COMPLETO (2026-07-11): migración (productos_credito
      con reglas JSONB, solicitudes, decisiones inmutables con razones) + RLS
      verificada; motor de decisión decidirSolicitud (score/revisión, mora buró,
      ingreso mínimo, capacidad 35%, LTV — explicable siempre); shared/finance.ts
      (amortización francesa EA→mensual en centavos, test de amortización total);
      ExperianMock determinista por último dígito de cédula (0-1 niega, 2-3
      revisión, 4-9 aprueba; penúltimo 9 = mora 90); caso de uso EvaluarSolicitud
      (buró caído → REVISION_MANUAL, nunca niega en automático); repos Supabase;
      module.ts. Total suite: 45 tests.
- [x] Módulo `cartera` COMPLETO (2026-07-11): migración (creditos con snapshot de
      condiciones, cuotas con acumulados por componente, pagos, aplicaciones_pago,
      links.solicitud_credito — primer Module Link real) + RLS verificada;
      generarPlanDePagos con LA MISMA cuotaMensualFrancesaCentavos de originación
      (test: cuota del plan === cuota prometida; capital amortiza exacto);
      repartirPago mora→interés→capital cuota más antigua primero (mora devengada
      por días vencidos sobre capital pendiente, tasa EA→diaria efectiva; test de
      propiedad: conservación del centavo en 50 escenarios); workflow
      DesembolsarCredito con compensación verificada en 2 puntos de falla;
      RegistrarPago emite cartera.pago.registrado con totales por componente
      (insumo contable); subscriber en originación marca solicitud desembolsada.
      Total suite: 71 tests.
- [x] Módulo `contabilidad` COMPLETO (2026-07-11): migración asientos+partidas
      (partida doble con check débito XOR crédito) + RLS (contable/financiero/ceo);
      crearAsiento con invariante débitos===créditos; plantillas asientoDeDesembolso
      (DB cartera/CR bancos) y asientoDePago (DB bancos/CR cartera+intereses+mora+
      anticipos); subscribers a los 2 eventos de cartera; WorldOfficeMock tras
      contrato SistemaContable; asiento se persiste SIEMPRE y despacho fallido
      queda 'fallido' para reintento. CORE COMPLETO. Total suite: 83 tests.
- [x] Ajustes pre-UI (2026-07-12): sagas en RegistrarPago/EvaluarSolicitud,
      fachadas por módulo, MotorDecision tras token, service_role documentado.
      Suite: 85 tests.
- [x] Reporteria (2026-07-12): schema con 4 vistas security_invoker —
      cartera_por_credito (saldo+días mora+franja), mora_por_franja
      (0-30/31-60/61-90/90+), resumen_cartera (ICV), recaudo_mensual (por
      componente). Verificadas con datos reales del seed.
- [x] seed.sql (2026-07-12): 2 tiendas, 5 usuarios por rol (password sumoto123),
      2 productos con reglas JSONB, 18 créditos con plan francés e historias:
      9 al día + moras en las 4 franjas. ICV demo: ~58%.
- [x] @sumo/contracts (2026-07-12): schemas Zod de frontera (registrar cliente
      discriminado escaner/manual, evaluar solicitud) reutilizando predicados
      del dominio con .refine(); DTOs de respuesta. Las pantallas jamás
      importan de domain/.
- [x] Backoffice UI (2026-07-12): proxy.ts (¡Next 16 renombró middleware→proxy!)
      con guarda de roles por prefijo; (auth)/login con branding SUMOTO;
      (vendedor)/solicitudes/nueva — escáner mock + decisión en vivo con razones
      y cuota; (financiero)/cartera — tarjetas resumen + ICV, barras de mora por
      franja, recaudo mensual por componente; rutas API delgadas (productos,
      clientes, evaluar) con exigirRol + conValidacion. Build de producción OK.
- [x] Bug de kernel corregido (2026-07-12): node-dependency-injection exige
      definición synthetic antes de set() — nuevo registrarServicio() en
      container.ts usado por los 4 module.ts + test de regresión con container
      real. Los tests unitarios no lo atrapaban porque los módulos usan fakes.
- [x] E2E de flujo completo contra Supabase local (flow.e2e.test.ts, se corre
      con `pnpm --filter @sumo/core test:e2e`): escaneo → APROBADO → desembolso
      (24 cuotas, cuota == la prometida) → pago → solicitud desembolsada por
      subscriber + 2 asientos cuadrados despachados a WO mock + link creado.
      PASÓ COMPLETO. Suite unitaria: 86 tests.

## En curso 🔨
- [ ] Recorrido de demo en navegador: `pnpm --filter backoffice dev` →
      login vendedor@sumoto.co / sumoto123 → /solicitudes/nueva (cédula
      terminada en 4-9 aprueba, 2-3 revisión, 0-1 niega) → login
      financiero@sumoto.co → /cartera. Pulir detalles visuales que aparezcan.

## Backlog no bloqueante 📥
- Regla de edad por producto (18–70) en reglas_decision JSONB del motor
  (auditoría 2026-07-11)
- Mover tasa_mora_ea al producto de crédito (hoy es snapshot en el crédito y
  llega como parámetro del comando de desembolso)
- RegistrarPago sin saga: pago y acumulados de cuotas en operaciones separadas
  (riesgo aceptado en demo; candidato a workflow o RPC transaccional)
- Inserts en dos pasos sin transacción (pago→aplicaciones, asiento→partidas):
  a futuro, función Postgres/RPC (revisión arquitecto 2026-07-11)
- Políticas DELETE/UPDATE faltantes en cartera y links: si el core termina usando
  cliente `authenticated` (no service_role), las compensaciones de la saga serían
  no-op silencioso. Resolver JUNTO con la decisión de cliente Supabase en fase UI
  (revisión arquitecto 2026-07-11)

## Siguiente (en orden) 📋
3. Módulo `contabilidad`: subscribers a cartera.credito.desembolsado y
   cartera.pago.registrado; tabla asientos; adaptador mock World Office
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
- 2026-07-11 (sábado): validación en 3 capas estilo Medusa v2 — Zod valida FORMA
  en rutas del backoffice (schemas en packages/contracts, wrapper conValidacion);
  dominio valida NEGOCIO en TS puro exportando predicados que Zod reutiliza con
  .refine(); RLS valida ACCESO. Zod nunca entra al dominio. Detalle en CLAUDE.md.
- 2026-07-11 (sábado): ingreso mínimo NO se valida al registrar cliente; es regla
  del producto en el motor de decisión de originación (auditoría de Julián).
- 2026-07-11 (sábado): matemática financiera compartida en packages/core/shared/
  (TS puro, sin negocio de un solo módulo): originación estima la cuota y cartera
  generará el plan con LA MISMA función — deben coincidir al centavo.
- 2026-07-11 (sábado): referencias entre módulos 1:1 (solicitud→cliente) como
  columna uuid SIN foreign key; las tablas de enlace en schema links quedan para
  relaciones creadas por workflows (solicitud↔credito en el desembolso).
- 2026-07-11 (sábado): sin reporte de buró la solicitud va a REVISION_MANUAL con
  causa visible — nunca se niega ni aprueba en automático sin información.
- 2026-07-11 (sábado): la mora NO se almacena — se devenga al calcular, por días
  vencidos sobre el CAPITAL pendiente de la cuota, con tasa EA→diaria efectiva
  ((1+EA)^(1/365)-1). Solo se persiste la mora pagada. El crédito guarda snapshot
  de tasas al desembolso (el producto puede cambiar después sin afectar créditos vivos).
- 2026-07-11 (sábado): el sobrante de un pago (sobrepago) se registra en el pago,
  no se aplica a nada en automático — decisión de negocio pendiente (¿abono a
  capital? ¿saldo a favor?). Convención de eventos con prefijo de módulo:
  cartera.credito.desembolsado (no credito.desembolsado a secas).
- 2026-07-11 (sábado): revisión de arquitectura del core completo (arquitecto-
  revisor): VEREDICTO APROBADO, cero violaciones de las 7 reglas. Corregido en
  caliente: los eventos de cartera ahora transportan la FECHA DEL HECHO
  (fechaDesembolso/fechaPago) y los asientos contables la usan — un pago
  retroactivo ya no genera asiento con fecha del servidor.
- 2026-07-12 (domingo): 4 ajustes pre-UI decididos con Julián (1a,2a,3a,4a):
  service_role en el core (backlog JWT por request); RegistrarPago y
  EvaluarSolicitud convertidos a workflows con compensación (+2 tests de
  compensación); fachada por módulo estilo Medusa (UN servicio por token);
  MotorDecision tras contrato+token DI (habilita modo sombra). Aprendizaje de
  saga: el kernel solo compensa pasos completados — un paso que falla a mitad
  restaura lo suyo antes de relanzar (aplicarACuotas). Suite: 85 tests.
- 2026-07-12 (domingo): plan de cuentas default (bancos) para la demo; diseño
  futuro registrado: plantillas contables por canal de financiación (fondeo
  propio = cartera contra ingreso por venta, autofinanciación SUMOTO).
- 2026-07-12 (domingo): Next 16 renombró middleware.ts → proxy.ts (función
  exportada `proxy`); la guarda de roles vive ahí. Los *.e2e.test.ts se excluyen
  de la suite normal (requieren Supabase local): vitest.e2e.config.ts.
- 2026-07-12 (domingo): FIX login roto — las tablas de `public` (tiendas,
  perfiles) se crearon SIN grants para authenticated/service_role (42501):
  Supabase local NO otorga privilegios automáticos en public y service_role
  bypassa RLS pero no los grants. Migración 20260712163738 + default privileges.
  Regla aprendida: TODA migración que cree tablas declara sus grants explícitos,
  también en public.
- (agregar nuevas decisiones aquí con fecha)