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
- [x] Capacidad `financiero`: crear producto de crédito + editar sus reglas de
      decisión + simulador de decisión sin persistir (2026-07-13). Dominio:
      `crearProducto`/`actualizarReglas`/`validarReglasDecision` (acumulan TODAS
      las violaciones, no cortocircuitan) en `credit-product.ts` (10 tests
      nuevos); casos de uso `CrearProductoCredito`/`ActualizarReglasDecision`;
      `OriginacionService.simularDecision` corre el motor real contra un
      producto candidato sin guardarlo. RLS: solo `rol_actual() = 'financiero'`
      escribe en `productos_credito`. Zod en `@sumo/contracts/schemas/
      manage-credit-product.ts` valida forma en la frontera.
- [x] Reporteria: 3 vistas nuevas para manager/contable/ceo con datos REALES
      (cero mocks) — `cartera_por_tienda`, `solicitudes_recientes`,
      `asientos_recientes` (`security_invoker`), expuestas en
      `ReporteriaService.carteraPorTienda/solicitudesRecientes/
      asientosRecientes`.
- [x] Port completo del diseño visual v0 (`~/Descargas/V0-Sumoto/
      sumoto-credit-platform`) al backoffice real, MISMA arquitectura SSR
      (2026-07-13): tema oscuro OKLCH en globals.css, `Marca`, `GaugeScore`,
      `Button` (CVA + @base-ui/react), átomos de presentación en
      `components/panel/ui.tsx` (PageHeader/Tarjeta/Kpi/EstadoBadge/
      BarraHorizontal/ColumnasMensuales), `PanelShell` con sesión/rol reales.
      Rechazado explícitamente del mockup: su auth con cookie sin firmar
      (falsificable) y su motor de decisión/amortización duplicado
      client-side (violación regla 1) — NINGUNO de los dos se portó.
      Config de nav por rol en `lib/roles-nav.ts` (políticas vive dentro de
      financiero, no es rol aparte). Las 5 pantallas por rol (vendedor,
      manager, financiero×2, contable, ceo) reskinned sobre las MISMAS
      fachadas del core, cero lógica de negocio nueva en la app.
      `proxy.ts` actualizado con los 4 prefijos nuevos (`/politicas`,
      `/tienda`, `/contabilidad`, `/ceo`). Verificado: 97/97 tests core,
      typecheck limpio, `pnpm --filter backoffice build` exitoso (8 rutas).
- [x] Tema corregido a claro/estilo Suzuki (2026-07-13): el port inicial de v0
      dejó el fondo blanco pero varios tokens (`--border`, `--popover`,
      `--secondary`, `--muted`, `--accent`, `--sidebar`) seguían con valores
      oscuros — bordes casi invisibles y tarjetas oscuras sobre fondo blanco.
      `globals.css` reescrito con paleta clara completa (`color-scheme: light`,
      primario azul `oklch(0.42 0.16 259)`). Bug real encontrado de paso:
      `Header`/`Footer` de marketing vivían en el layout raíz y se filtraban
      encima del panel autenticado (que ya tiene su propio sidebar/header) —
      movidos a que solo los use la landing (`app/page.tsx`). `Header` pasó de
      `fixed` (fuera del flujo, necesitaba `pt-36` manual) a `sticky top-0` con
      `bg-background/80 backdrop-blur`, sin hack de padding.
- [x] Animaciones de entrada en la landing (2026-07-13), pura curva
      Disney (slow-in/slow-out, ease-out): logo + tagline del Header con
      `@keyframes` CSS puro (sin JS, respeta `prefers-reduced-motion`); las 3
      tarjetas de features usan `RevealOnScroll` (`components/shared/
      reveal-on-scroll.tsx`) — único componente `"use client"` de la landing,
      justificado porque detectar scroll-into-view con `IntersectionObserver`
      es inherentemente de navegador. Se dispara una vez por tarjeta con
      stagger de 100ms, no se revierte al volver a subir.
- [x] Login rediseñado con fidelidad literal al mockup v0 (2026-07-13, sobre
      la MISMA lógica real, no la del mockup): layout de 2 columnas (form +
      foto de moto con degradado), panel de "usuarios demo" con los 5 roles
      reales (verificados contra `supabase/seed.sql`) que autocompletan
      correo+`sumoto123`, y botón con estado "Ingresando…" vía
      `useFormStatus`. Todo en `components/login/formulario-login.tsx`
      (`"use client"` solo por la interactividad; la Server Action `ingresar`
      no cambió). `cerrarSesion()` ahora redirige a `/` en vez de `/login`.
- [x] Redirect `next` implementado end-to-end (2026-07-13): `proxy.ts` agrega
      `?next=<ruta original>` al mandar a `/login` (sin sesión o rol
      denegado); el form lo lleva como campo oculto; la action valida con
      `siguienteSeguro()` que sea una ruta interna (`/…`, nunca `//` ni un
      host externo — anti open-redirect) antes de redirigir ahí tras login
      exitoso, y lo preserva también en los redirects de error. Verificado en
      navegador: entrar a `/politicas` sin sesión → login → aterriza en
      `/politicas`, no en la home fija del rol.
- [x] shadcn/ui instalado correctamente (2026-07-13): no existía
      `components.json` — por eso pegar componentes a mano fallaba (traían la
      variante Radix, y este proyecto usa `@base-ui/react`, paquete distinto).
      `npx shadcn@latest init --preset nova --base base` generó la config
      apuntando a la librería `base` (igual que el `Button` ya existente). El
      init SOBREESCRIBIÓ `globals.css` con la paleta neutra por defecto — se
      reconcilió a mano devolviendo la paleta azul/clara y corrigiendo
      `--font-sans` (había quedado autoreferenciada, ya no apuntaba a Geist),
      conservando lo nuevo útil (`--sidebar-*`/`--chart-*`, `tw-animate-css`).
      `npx shadcn@latest add sidebar --overwrite` trajo `sheet`/`sidebar` (y
      sus dependencias: `input`, `separator`, `tooltip`, `skeleton`,
      `use-mobile`) ya resueltos en `@base-ui/react`. `lib/cn.ts` quedó como
      re-export de `lib/utils.ts` (el alias que usa `components.json`) para no
      tener dos implementaciones duplicadas. `app/layout.tsx` envuelto en
      `<TooltipProvider>` (lo pide el Sidebar para el modo icono).
- [x] `PanelShell` migrado al Sidebar de shadcn (2026-07-13): reemplaza el
      sidebar hecho a mano (useState propio para el menú móvil — ya no hace
      falta, el `SidebarProvider` lo resuelve con el `Sheet` instalado). Logo
      real en vez del componente `Marca` (texto); cada ítem de
      `lib/roles-nav.ts` ahora lleva su `icon` (Lucide). `Sidebar
      collapsible="icon"`: al colapsar en escritorio queda una columna delgada
      SOLO con íconos (antes desaparecía del todo) — con tooltip por ítem
      (`SidebarMenuButton tooltip=...`) y el logo cambia al ícono cuadrado
      `sumoto-s-icon-128.png` (los otros dos elementos que trajo Julián,
      `sumoto-s-icon.png`/`-v2.png`, son la misma marca sin recortar a
      cuadrado — se usó la versión 128×128 ya cuadrada). En móvil el mismo
      Sidebar se abre como panel deslizante (Sheet), sin código adicional.
      Los links (nav + "Cerrar sesión") usan el mismo lenguaje de hover que
      home/login: borde inferior negro siempre visible que se completa a
      marco entero en hover, con transición de color de 200ms (no de ancho,
      eso no anima suave). Verificado en navegador: colapsado, tooltip, móvil
      (390px), build de producción.

## En curso 🔨
- [x] `exigirRol` (apps/backoffice/lib/auth.ts) delega la política de
      autorización 100% al core: ya no hace `permitidos.includes(rol)` inline,
      llama `seguridadService().tieneAcceso(userId, permitidos)`. `lib/` queda
      como puro traductor a HTTP (401/403); la decisión de "quién puede qué"
      vive en `SeguridadService` (2026-07-12).
- [ ] Recorrido de demo en navegador con el diseño nuevo, los 5 roles:
      `pnpm --filter backoffice dev` → vendedor@sumoto.co (/solicitudes/nueva,
      cédula 4-9 aprueba/2-3 revisión/0-1 niega) → manager@sumoto.co (/tienda)
      → financiero@sumoto.co (/cartera y /politicas: crear producto, editar
      reglas, simular) → contable@sumoto.co (/contabilidad) → ceo@sumoto.co
      (/ceo). Typecheck+build ya verdes; falta el recorrido visual en vivo.

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
- Llamadas de auth redundantes entre `proxy.ts` y los `layout.tsx` por rol
  (2026-07-13): hoy cada navegación a una ruta protegida hace hasta 4 idas y
  vueltas de red (proxy: `auth.getUser()` + `from("perfiles")`; layout vía
  `exigirRol()`: OTRO `auth.getUser()` + otra consulta al core). Sin impacto en
  la demo (Supabase local, latencia ~0), pero en producción con tráfico real
  suma latencia percibida y puede chocar con límites de tasa del servicio de
  Auth de Supabase. Mitigaciones estándar, sin bajar el estándar de seguridad:
  (1) rol como *custom claim* firmado en el JWT (Supabase Auth Hooks), para que
  `proxy.ts` lo lea decodificando el token sin consulta a Postgres; (2)
  `getSession()` (decodificación local, sin red) para el gate rápido en
  `proxy.ts`, dejando `getUser()` (revalidación autoritativa contra el
  servidor) solo en el layout; (3) `React.cache()` envolviendo
  `obtenerSesion()`/`exigirRol()` para deduplicar dentro de una misma request
  si varios componentes la invocan. No bloquea la demo.

### Outbox persistente del event bus (diseño, 2026-07-12)
Hoy `EventBus` (kernel/event-bus.ts) vive solo en memoria: si el proceso muere
entre completar un paso de saga y que el subscriber termine (ej. pago guardado
pero contabilidad no alcanzó a generar el asiento), el evento se pierde para
siempre y nadie se entera — riesgo aceptado en demo, inaceptable en producción.
- Tabla `kernel.eventos_salientes` (o por schema de módulo): id, nombre,
  payload jsonb, correlacion_id, estado (pendiente/procesado/fallido),
  intentos, creado_en.
- El evento se inserta en la MISMA transacción que el hecho de negocio (mismo
  repositorio/RPC que guarda el pago/crédito/asiento) — ahí está la garantía:
  si el commit no pasa, el evento tampoco existe.
- Un despachador aparte (poller o `pg_notify`) lee pendientes, invoca los
  subscribers con reintento y backoff, marca procesado.
- Consecuencia obligatoria: los subscribers deben ser IDEMPOTENTES (recibir el
  mismo evento dos veces no debe duplicar asientos ni reventar). Los de hoy
  (contabilidad, originación) no lo son todavía — se revisa al implementar esto.
- Encaja con Medusa v2: ellos ya persisten el estado de ejecución de workflows
  (`workflow_execution`) exactamente por esta razón.

### Cliente por-request con JWT + cookie de sesión (diseño, 2026-07-12)
Hoy el core opera con UN cliente `service_role` (privilegios plenos, RLS no
aplica en su camino); la seguridad depende de que el proxy + `exigirRol`
validen bien. Decisión de Julián: NO instanciar un cliente Supabase por
request (evita el costo de armar un container "scoped" en cada llamada).
En su lugar:
- Al hacer login, además de las cookies de sesión de Supabase Auth, se firma
  una cookie propia (httpOnly, firmada/encriptada) con el payload mínimo del
  perfil: `{ userId, rol, tiendaId }` — la misma forma que hoy devuelve
  `SeguridadService.perfilDe()`.
- Las rutas/actions leen esa cookie (sin ida a la base) para decisiones de UI
  rápidas; para RLS real de punta a punta, el JWT de Supabase Auth (que YA
  viaja en las cookies de `@supabase/ssr`) se adjunta a las queries que deban
  respetar RLS por fila — vía un cliente Supabase construido con ese JWT SOLO
  en los puntos que lo necesiten (ej. una vista con RLS activo), no como
  reemplazo del `service_role` del core.
- Requiere completar las políticas DELETE/UPDATE en cartera/links que hoy
  faltan (ver ítem de arriba) para que las compensaciones de saga no sean
  no-op silencioso bajo un rol `authenticated`.
- Punto de partida YA HECHO: `SeguridadService.tieneAcceso(userId, roles)`
  en el core, consumido por `lib/auth.ts` — la política de autorización ya
  no vive en la app, que es el prerequisito de este diseño.

## Siguiente (en orden) 📋
1. Módulo `notificaciones` (mañana, 2026-07-14): alcance por definir al
   retomar — candidatos naturales dado lo que ya existe: evento
   `cartera.credito.desembolsado`/`cartera.pago.registrado` disparando un
   aviso, y algo para `originacion` (decisión lista). Debe seguir la misma
   anatomía de módulo (domain/application/infrastructure/subscribers/
   module.ts/index.ts) y el patrón adaptador para el canal de envío (¿email?
   ¿solo in-app?) — mock intercambiable como Experian/World Office. Definir
   con Julián: ¿quién recibe qué? ¿tabla propia o solo push por evento?
2. Recorrido de demo en navegador con el diseño nuevo, los 5 roles (sigue
   pendiente de la sesión anterior, ver "En curso" arriba).
3. Recorrido completo del proyecto — core y backoffice (más tarde, mismo
   día): revisión general de lo construido hasta ahora, sin alcance
   detallado todavía.

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
- 2026-07-12 (domingo): corrección de arquitectura señalada por Julián — el
  backoffice consultaba vistas de reporteria directo contra Supabase. Nuevos
  módulos: `reporteria` (ReporteriaService: resumenCartera, moraPorFranja,
  recaudoMensual — completa el service.ts que inició Julián: import, errores
  propagados, tipos, module.ts) y `seguridad` (SeguridadService.perfilDe — el
  perfil viene del core; el plumbing de cookies queda en la app; auth NO va en
  el kernel). supabaseAdmin ya NO se exporta de lib/core-server.
- 2026-07-12 (domingo): backoffice migrado a SSR puro — login por server action
  (credenciales nunca tocan JS del navegador) y wizard del vendedor multi-paso
  con actions + searchParams. Nuevas lecturas en fachadas:
  ClientesService.buscarPorCedula, OriginacionService.solicitudEvaluada.
- 2026-07-12 (domingo): FIX crash de /cartera — "Invalid schema: reporteria":
  PostgREST solo carga api.schemas de config.toml AL ARRANCAR sus contenedores;
  `db reset` NO los reinicia. Regla: tras editar config.toml →
  `pnpm supabase stop && pnpm supabase start`.
- 2026-07-12 (domingo): RegistrarAsiento convertido a workflow con compensación
  (encabezado sin partidas = asiento huérfano, ya imposible; el despacho a World
  Office es best-effort y nunca revierte el asiento). Login valida forma con
  LoginRequestSchema de @sumo/contracts. Doctrina de workflows aclarada:
  reporteria y seguridad NO llevan workflow porque no MUTAN nada (solo lectura)
  — las sagas protegen mutaciones multi-paso, no consultas. Suite: 87 tests.
- 2026-07-13 (lunes): revisado el mockup v0 de Julián (Vercel v0,
  `~/Descargas/V0-Sumoto/sumoto-credit-platform`) SOLO como referencia visual.
  Su auth (cookie base64url sin firmar, `USUARIOS_DEMO` hardcodeado) y su motor
  de decisión/amortización duplicado en `lib/credito.ts` del lado cliente
  quedaron explícitamente descartados por violar reglas 1 y 6 — no se porta
  ninguno de los dos, solo tokens de diseño y componentes de presentación pura.
- 2026-07-13 (lunes): "políticas de crédito" NO es un rol nuevo — decisión de
  Julián: el financiero, además de ver KPIs de cartera, crea el producto de
  crédito y administra sus reglas de decisión. Pantalla `/politicas` vive
  bajo el mismo rol `financiero`, misma RLS.
- 2026-07-13 (lunes): cliente por-request con JWT/cookie propia sigue
  backlogueado sin implementar (ver diseño arriba) — evaluado explícitamente
  con Julián y descartado para el alcance de la demo; no bloquea nada de lo
  entregado hoy.
- 2026-07-13 (lunes): FIX seguridad — los 5 layouts por rol ((vendedor)
  (manager) (financiero) (contable) (ceo)) solo llamaban `obtenerSesion()`
  (¿hay sesión?) sin validar ROL, dependiendo 100% de que `proxy.ts` gatee
  bien cada prefijo. Detectado por revisión automática de seguridad: un
  cambio futuro al `matcher`/ACCESOS de `proxy.ts` habría quitado la única
  puerta sin que ningún layout lo notara. Corregido: los 5 layouts ahora
  llaman `exigirRol([...])` (ya existía, ya usado en server actions) —
  segunda puerta real en cada uno, no solo en el edge. De paso, se detectó
  que la entrada `/cartera` en `proxy.ts` seguía permitiendo
  manager/contable/ceo (arrastre de cuando /cartera era el único dashboard,
  antes de que cada rol tuviera el suyo): se acotó a `["financiero"]`, que
  es lo único que hoy enlaza `lib/roles-nav.ts`. Verificado: typecheck limpio
  + build exitoso tras el fix.
- 2026-07-13 (lunes): Julián empezó a re-estilar el backoffice hacia una
  identidad visual tipo Suzuki (globalsuzuki.com) — fondo blanco, azul
  corporativo — en vez del tema oscuro que se había portado de v0. FIX de
  consistencia: varios tokens de color en `globals.css` se habían quedado
  oscuros pese al fondo blanco (bordes casi invisibles, tarjetas oscuras);
  reescritos a paleta clara completa. Bug real encontrado y corregido: el
  `Header`/`Footer` de marketing vivían en el layout raíz y se renderizaban
  también encima del panel autenticado de cada rol.
- 2026-07-13 (lunes): feedback explícito de Julián — al portar un diseño de
  referencia (v0 antes, Suzuki ahora) espera fidelidad literal a componentes
  y layout, no una versión adaptada/simplificada por iniciativa propia. Única
  excepción legítima: violaciones reales de las reglas 1/6 (auth insegura o
  lógica de negocio duplicada del lado cliente), como ya se había hecho con
  el mockup v0. Aplicado en el rediseño del login: se replicó el layout de
  v0 (2 columnas, panel de usuarios demo, estado de carga) tal cual, solo
  cambiando la Server Action de fondo por la real del proyecto.
- 2026-07-13 (lunes): discutido el costo de las llamadas de auth redundantes
  entre `proxy.ts` y los `layout.tsx` por rol (hasta 4 idas y vueltas de red
  por navegación protegida) — sin impacto en la demo (Supabase local), sí en
  producción con tráfico real. Registrado como backlog no bloqueante (ver
  arriba), con 3 mitigaciones concretas (custom claim de rol en el JWT,
  `getSession()` para el gate rápido, `React.cache()` para deduplicar dentro
  de una request) — no implementado aún, solo diagnóstico y diseño.
- 2026-07-13 (lunes): shadcn/ui se instala SIEMPRE vía CLI (`npx shadcn@latest
  init`/`add`), nunca pegando archivos a mano — sin `components.json` la CLI
  no sabe resolver alias/dependencias, y los ejemplos de la doc de shadcn
  vienen en Radix por defecto, no en `@base-ui/react` (lo que ya usa este
  proyecto desde el `Button` original). `init --base base` es obligatorio
  para que coincida. Lección cara: `init` reescribe `globals.css` con su
  paleta neutra por defecto sin avisar — SIEMPRE respaldar el archivo antes
  de correrlo si tiene tema custom (aquí sí se hizo backup y se reconcilió a
  mano; si no, se habría perdido toda la paleta Suzuki de la sesión).
- 2026-07-13 (lunes): sidebar de `PanelShell` migrado al Sidebar de shadcn en
  modo `collapsible="icon"` — decisión de Julián de que la columna colapsada
  muestre íconos (con tooltip) en vez de ocultarse del todo. El logo cambia
  entre el wordmark completo (expandido) y `sumoto-s-icon-128.png` (ícono
  cuadrado, colapsado) vía `group-data-[collapsible=icon]:hidden`/`:block`.
- (agregar nuevas decisiones aquí con fecha)