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

## En curso 🔨 (jornada sábado 2026-07-11)
- [ ] Módulo `contabilidad` (siguiente): subscribers a cartera.credito.desembolsado
      y cartera.pago.registrado; tabla asientos; adaptador mock World Office

## Backlog no bloqueante 📥
- Regla de edad por producto (18–70) en reglas_decision JSONB del motor
  (auditoría 2026-07-11)
- Mover tasa_mora_ea al producto de crédito (hoy es snapshot en el crédito y
  llega como parámetro del comando de desembolso)

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
- (agregar nuevas decisiones aquí con fecha)