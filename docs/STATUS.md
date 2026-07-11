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

## En curso 🔨
- [ ] Módulo `clientes`:
  - [ ] Migración SQL: schema clientes, tabla clientes, tabla perfiles (user→rol→tienda)
  - [ ] Dominio: entidad Cliente, contrato FuenteIdentidad, tipo DatosCiudadano
  - [ ] Caso de uso registrarClienteDesdeEscaneo + implementación EntradaManual
  - [ ] ProveedorIdentidadMock (simula el escáner del tercero)
  - [ ] module.ts + registro en el arranque

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
- (agregar nuevas decisiones aquí con fecha)