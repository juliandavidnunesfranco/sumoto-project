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
- [x] Wizard del vendedor completo, fiel al diseño de v0 pero con lógica REAL
      (2026-07-13): descompuesto en componentes chicos bajo
      `components/vendedor/` (`galeria-motos`, `tarjeta-cliente`,
      `tarjeta-decision`, `plan-de-pagos`, `subir-documentos`,
      `descargas-documento`) en vez de un solo archivo de 500+ líneas.
      - Galería decorativa de 6 motos (`lib/motos-catalogo.ts`, mismas fotos
        ya usadas en el sitio) — elegir una solo pre-llena el precio del
        formulario real, con check visual de seleccionada.
      - `OriginacionService.consultarRiesgo(cedula)`: nuevo método delgado
        para mostrar el score justo tras escanear, antes de armar el crédito.
      - **Dominio real extendido** (no UI inventada): `ReporteRiesgo` ahora
        incluye `reportesNegativos` y `vectoresPago[]` (entidad/tipo/saldo/
        días mora — lo que un buró real reporta); `Cliente`/`DatosCiudadano`
        ahora incluyen `estrato` (1-6, validado) y `geoCoincide`. Poblados en
        `ExperianMock`/`EscanerCedulaMock` de forma determinista por cédula.
        Migración `20260713221609` agrega las columnas a
        `clientes.clientes`. 103/103 tests (6 nuevos de validación de
        estrato).
      - Plan de pagos preview con `generarPlanDePagos` (@sumo/core, LA MISMA
        función que cartera usará al desembolsar — nunca se duplicó la
        matemática en la app). Bug propio encontrado y corregido: se le
        pasaba `.toISOString()` completo (con hora) a una función que espera
        fecha plana `yyyy-mm-dd`, dando fechas "2026-08-Na" en la tabla.
      - Pagaré y CSV de descarga, marcados explícitamente "DOCUMENTO DE
        DEMOSTRACIÓN — SIN VALIDEZ LEGAL" (decisión de Julián, dado que es
        contenido con apariencia legal generado en el navegador).
      - Navegación entre pasos con Tabs de shadcn (`collapsible` por
        disponibilidad: no se puede saltar a un paso sin los datos previos),
        reemplazando las tarjetas apiladas — resuelve la queja de "wizard muy
        largo". Requirió `nativeButton={false}` en `TabsTrigger` al usar
        `render={<Link/>}` (si no, Base UI advierte por semántica de botón).
      - Rechazado explícitamente del mockup: el motor de decisión y el
        escaneo de cédula corriendo 100% en el cliente — se usan las
        fachadas reales del core en ambos casos.

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
- [x] Módulo `catalogo` (motos con precio contado/crédito), buscador de
      clientes en el header (solo vendedor) y buscador+paginación de motos en
      el wizard, cargos adicionales seleccionables por solicitud — 103/103
      tests, typecheck limpio, build exitoso, recorrido E2E en navegador
      verificado (login → buscar cliente → elegir moto con búsqueda/filtro →
      armar crédito con cargos → decisión con LTV correcto) (2026-07-14).
- [x] **BUG de imágenes en producción — RESUELTO** (2026-07-14, madrugada):
      los 2 usos decorativos (`app/page.tsx` home y `app/(auth)/login/page.tsx`)
      que apuntaban a `/motos/*.png` movidos al bucket — se copiaron
      `sport-250.png` y `naked-300.png` de vuelta a `public/motos/` (quedan
      duplicados a propósito: bucket = catálogo, public = marketing/login).
      Verificado en navegador: ambas cargan.
- [ ] **Ruido en logs de producción, no bloqueante pero feo para una demo en
      vivo** (2026-07-14): tras un `supabase db reset` (que regenera todos
      los `auth.users` con ids nuevos), una cookie de sesión vieja en el
      navegador dispara `AuthApiError: Invalid Refresh Token: Refresh Token
      Not Found` en el server log de `next start` — no rompe nada (el login
      sigue funcionando), pero ensucia la consola. **Mitigación para la demo:
      navegador en incógnito.** Fix de código pendiente: capturar
      `refresh_token_not_found` donde se llama
      `supabase.auth.getUser()`/`getSession()` y limpiar cookie / redirigir
      a `/login`.
- [x] **Buscador SSR reutilizable — RESUELTO** (2026-07-14, madrugada): nuevo
      `components/shared/input-busqueda.tsx` (client mínimo: SOLO narra la
      URL con debounce; el fetch siempre es del server component contra la
      fachada del core). Lo usan el header (→ página `/buscar` SSR nueva, con
      dos puertas: proxy.ts + layout) y la galería de motos. El buscador
      client-side viejo (`buscador-header/` con server action + dropdown) fue
      ELIMINADO. **Bug de debounce corregido**: el useEffect que sincronizaba
      URL→input pisaba el texto mientras se escribía (se "borraba y
      reaparecía"); ahora solo sincroniza cuando el input no tiene el foco.
      Verificado en navegador con escritura + navegaciones en vuelo.

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

### ~~Para mañana 2026-07-17~~ ✅ HECHO 2026-07-17 (mañana)
1. ~~Búsqueda en TODAS las tablas, sobre CUALQUIER columna~~ ✅ Opción A
   implementada: mapas de búsqueda por vista en el core. Ver bitácora
   2026-07-17.
2. ~~Replicar TablaDatos + filtros en contable y ceo~~ ✅ Contable con
   filtros completos + búsqueda; CEO estrenó tabla "Cartera por tienda"
   (carteraPorTienda ganó orden/filtros/búsqueda). Ver bitácora.

### Backlog acordado para la tarde del 2026-07-15 (Julián aceptó TODAS)
Propuestas mías aceptadas ("me gustan todas"):
1. ~~Meta de colocación mensual con barra de progreso~~ ✅ HECHO 2026-07-17
   (migración meta_colocacion_centavos + barra en /tienda). Ver bitácora.
2. ~~Alerta de mora de la tienda en `/hoy`~~ ✅ HECHO 2026-07-17. Ver bitácora.
3. ~~Exportar CSV respetando los filtros activos~~ ✅ HECHO 2026-07-17
   (3 rutas de descarga + botón CSV en TablaDatos). Ver bitácora.

Ideas nuevas de Julián (mismo mensaje):
4. ~~**Tabla genérica compartida**~~ ✅ HECHO 2026-07-15: `TablaDatos`
   (server, genérica para cualquier dato) + `EncabezadoColumna` (client:
   cada encabezado con su orden y filtro, decisión de Julián — mismo
   formato en todas las tablas, sin fila de filtros aparte). Ver bitácora.
5. **Filas de desempeño con color de avance**: en desempeño de tienda y por
   asesor, cada fila con background de color mostrando su avance de
   colocación (estilo barra de progreso embebida en la fila).
6. ~~**BUG barras del gráfico**~~ ✅ ARREGLADO 2026-07-15: era `height: %`
   dentro de una cadena flex sin altura definida (items-end desactiva el
   stretch) — barras ahora en px sobre el área fija. Ver bitácora.
7. **Seguimiento por asesor**: apartado propio donde el manager compara el
   desempeño de cada asesor contra su presupuesto de colocación asignado
   (requiere modelo de presupuesto/meta por vendedor).
8. **Impulso por moto**: ver qué moto tiene más/menos impulso en
   financiación para que el manager lo gestione.
9. **Canal de comunicación entre roles** vía Supabase Realtime/webhook:
   apartado para crear canales grupales o uno-a-uno.

### Backlog previo (sigue vigente)
0. ~~Pantalla de desembolso~~ ✅ HECHO 2026-07-15: decisión de Julián — el
   rol FINANCIERO desembolsa. Sección "Pendientes de desembolso" en
   /cartera con acción por fila. Ver bitácora.
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
  y build exitoso tras el fix.
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
- 2026-07-13 (lunes): al portar el paso 1 del wizard de v0 (tarjeta de
  cliente + riesgo), decisión con Julián sobre 4 datos que v0 mostraba sin
  respaldo real: (1) vectores de pago por entidad y reportes negativos —
  SÍ se modelan como extensión real de `ReporteRiesgo`/`ExperianMock` (es
  literalmente lo que un buró real reporta, no dato inventado sin sentido);
  (2) estrato y dirección — SÍ, extendidos en `Cliente`/`EscanerCedulaMock`
  (dirección ya existía en el tipo, solo faltaba poblarla); (3)
  geo-coincidencia — se agrega como mock también aunque hoy no hay ninguna
  captura real de geolocalización en el flujo (placeholder explícito hasta
  que exista); (4) navegación entre pasos — Tabs de shadcn en vez de tarjetas
  apiladas, deshabilitadas hasta que el paso previo tenga los datos que
  necesita.
- 2026-07-14 (martes): nuevo módulo `catalogo` (Moto: precio contado y precio
  crédito SIEMPRE distintos, specs, imagen) — decisión con Julián de módulo
  nuevo en vez de extender `originacion`, porque el catálogo de motos es un
  concepto de negocio propio (inventario/pricing) sin relación de dominio con
  solicitudes. Migración `catalogo.motos` con RLS de solo lectura; seed con 6
  motos reales tomadas del screenshot de v0 (`Imagen_pegada_2.png`), specs y
  precios distintos por unidad. `lib/motos-catalogo.ts` (catálogo decorativo
  estático) ELIMINADO — ya no queda ninguna referencia, reemplazado 100% por
  el módulo real.
- 2026-07-14 (martes): dos buscadores nuevos, ambos vía fachada del core
  (nunca Supabase directo desde la app), con debounce corto (250-300ms):
  (1) buscador en el header de `PanelShell` (`components/shared/
  buscador-header/`), solo visible para rol vendedor, reemplaza el texto
  inerte "Tienda asignada" — busca clientes ya registrados por cédula/nombre
  vía `ClientesService.buscarClientes` (nuevo método + `RepositorioClientes.
  buscar`, acotado por `tiendaId` igual que la RLS de lectura); (2) buscador
  de motos en el paso 2 del wizard (`components/vendedor/buscador-motos.tsx`)
  que narra vía searchParams (`motoQuery`/`motoPagina`/`motoPorPagina`) contra
  `CatalogoService.buscarMotos` — el fetch real ocurre en el server component
  de la página, el cliente solo actualiza la URL (`router.replace`, sin
  ensuciar el historial). Paginación (`PaginacionMotos`) con selector de
  tamaño de página (10/20/40/50) vía Link + searchParams, cero JS.
- 2026-07-14 (martes): cargos adicionales (papelería, SOAT, matrícula, seguro
  de vida) — decisión explícita de Julián: seleccionables por el vendedor EN
  CADA SOLICITUD (checkboxes en "Arma el crédito"), NO atributo fijo del
  catálogo de motos. Nuevo campo opcional `cargosAdicionalesCentavos` en
  `Solicitud`/`DatosSolicitud` (dominio `originacion`), sumado en
  `montoAFinanciarCentavos` — afecta correctamente LTV y cuota estimada del
  motor de decisión (probado en vivo: 2 cargos de 150k+450k subieron el LTV
  de forma consistente con la fórmula). Migración agrega la columna con
  default 0. Formulario usa el patrón nativo de checkboxes múltiples con el
  mismo `name="cargo"` — la Server Action suma `formData.getAll("cargo")`,
  cero JavaScript necesario.
- 2026-07-14 (martes): imágenes del catálogo migradas a Supabase Storage
  (bucket público `motos`) — decisión con Julián de bucket público (son fotos
  de producto, no datos sensibles) poblado desde `supabase/seed-assets/motos/`
  vía `[storage.buckets.motos]` en `config.toml` (`objects_path`), NO subido a
  mano por Studio. `catalogo.motos.imagen` ahora guarda solo el nombre del
  objeto; la URL pública la resuelve `RepositorioMotosSupabase` (infra, no
  dominio) con `storage.from("motos").getPublicUrl()`. FIX encontrado en el
  camino: el optimizador de imágenes de Next bloquea por SSRF cualquier IP
  privada como origen (127.0.0.1 en local siempre cae ahí) — `next/image`
  necesita `unoptimized` para estas imágenes remotas, `remotePatterns` solo
  no alcanza.
- 2026-07-14 (martes): hallazgo real al revisar con Julián cómo se relacionan
  los módulos — `originacion.solicitudes` NO guardaba `moto_id` en ningún
  lado (solo vivía en el searchParams del wizard); una vez evaluada la
  solicitud no quedaba registro de qué moto se financió. Aclarada la regla
  real de `links` vs columna plana: `links.solicitud_credito` existe porque
  esa relación NACE como efecto secundario de un workflow multipaso
  (desembolso) que puede revertirse a medio camino; `moto_id`, en cambio, se
  conoce desde el momento en que se CREA la solicitud — mismo patrón que
  `cliente_id`/`producto_id` (columna uuid plana, sin FK cruzada, regla 3).
  Agregado en dominio (`Solicitud.motoId`, obligatorio), migración, mapper,
  contrato Zod y `actions.ts` (el hidden input ya existía en el formulario,
  pero no se estaba reenviando al core). Seed reordenado: el catálogo de
  motos se siembra ANTES del loop de 18 créditos demo para poder asignarles
  una moto real (`select id into v_moto from catalogo.motos order by
  random()...`). Verificado: 103/103 tests, e2e completo (escaneo→
  decisión→desembolso→pago→asientos) en verde, join `solicitudes.moto_id →
  catalogo.motos` confirmado por psql en las 18 filas del seed.
- 2026-07-14 (madrugada, pre-presentación): auditoría crítica completa con el
  agente arquitecto-revisor (veredicto: núcleo APROBADO, 7 reglas sin
  violaciones duras, dinero limpio, todas las actions con auth) + corrección
  de TODO lo accionable en 4 bloques, verificado en navegador y con
  103/103 tests:
  (A) imágenes decorativas restauradas en `public/motos/` (home/login);
  sidebar activo visible y patrón hover unificado en 8 sitios a
  `border border-transparent hover:border-black` — el borde siempre ocupa
  1px y solo cambia el color: sin salto de layout, que es lo que el
  comentario de panel-shell describía desde el principio.
  (B) SEGURIDAD: los cargos adicionales ahora viajan como ID y el monto se
  resuelve en el servidor (un form manipulado ya no puede inventar montos —
  verificado: mismo LTV 83.1%); scoping por tienda replicado en
  `buscarPorCedula`/`solicitudEvaluada` del wizard, en `/buscar` y en
  `(manager)/tienda` (sin tienda asignada = vacío, nunca alcance nacional);
  `consultarRiesgo` solo corre cuando la pestaña activa es "cliente" (con
  Experian real, cada render costaría una consulta al buró); CLAUDE.md
  actualizado con `catalogo` y `seguridad` en la lista de módulos.
  (C) cosméticos: `rounded-0`→`rounded-none`, `text-md`→`text-base`,
  `font-heading`→`font-headline` en el título del paso 1, la búsqueda y
  paginación de motos se conservan al seleccionar moto y al cambiar de
  pestaña (helper `qsBase()` + prop `hrefMoto`), `marca.tsx` huérfano
  eliminado, JSX limpio.
  Deuda ACEPTADA y defendible (no corregida a conciencia): composición del
  plan de pagos en la página (misma función pura del core, cero duplicación
  de reglas); catálogo de cargos en `lib/` de la app (conceptos de negocio —
  candidato a moverse al core con los productos); `console.log` del kernel
  se DEJAN (muestran el bus de eventos en vivo durante la demo).
- 2026-07-14 (madrugada): pantalla "Mis solicitudes" del vendedor
  (`app/(vendedor)/solicitudes/page.tsx`, item nuevo en roles-nav): tabla SSR
  sobre `reporteriaService().solicitudesRecientes` con acciones por fila —
  ver en el wizard (`?solicitudId&paso=decision`), llamar (`tel:+57...`) y
  WhatsApp (`wa.me/57...`). La vista `reporteria.solicitudes_recientes` se
  extendió (migración `20260714043127`) con `cliente_cedula`,
  `cliente_telefono` y `plazo_meses` (columnas AL FINAL: `create or replace
  view` no permite alterar las existentes) y el service ahora ordena
  explícito por `creado_en desc` (el ORDER BY de una vista no sobrevive a
  PostgREST). LIMITACIÓN documentada: el alcance es por TIENDA, no por
  usuario — `originacion.solicitudes` no registra quién la creó
  (`creado_por` queda en backlog; hoy vendedor y manager de la misma tienda
  ven las mismas filas).
- 2026-07-14 (madrugada): controles de la galería de motos reubicados —
  buscador arriba junto al h2; selector de tamaño de página y paginación
  ABAJO de la galería (pedido explícito de Julián: "no estoy acostumbrado a
  verla arriba"). La paginación ahora se muestra SIEMPRE (antes se ocultaba
  con una sola página y parecía que faltaba), con botones deshabilitados si
  no hay más páginas. `buscador-motos.tsx` eliminado: quedó `InputBusqueda`
  (compartido) + `selector-por-pagina.tsx`.
- 2026-07-14 (madrugada): aclarado el flujo de aprobación/desembolso con
  Julián — el vendedor NO aprueba nada: la decisión la emite el motor
  automáticamente al evaluar (APROBADO/NEGADO/REVISION_MANUAL). El
  DESEMBOLSO es otro acto de negocio: el workflow con compensación
  `CarteraService.desembolsarCredito` ya existe en el core (crédito + plan +
  link + evento, cubierto por tests y usado en el seed/e2e), pero NO tiene
  pantalla todavía — ninguna vista lo invoca. Pendiente de decidir con
  Julián: qué rol desembolsa (candidato natural: financiero, o manager de
  tienda) y dónde vive el botón. REVISION_MANUAL tampoco tiene bandeja de
  revisión (nadie puede convertirla en aprobado/negado desde la UI).
- 2026-07-14 (madrugada): `creado_por` en `originacion.solicitudes` —
  discutido con Julián: él propuso tabla `links` (solicitud-cliente-perfil),
  pero se aplicó la regla ya establecida (misma que `moto_id`): `links` es
  para relaciones que NACEN de un workflow compensable; el creador se conoce
  al CREAR la fila → columna plana `creado_por uuid not null references
  public.perfiles (user_id)` — patrón idéntico a `tienda_id` (FK
  módulo→public permitida). El valor sale SIEMPRE de la sesión del servidor
  (action y ruta API), jamás del formulario: el navegador no puede atribuir
  la solicitud a otro vendedor. Seed: segundo vendedor
  (vendedor.medellin@sumoto.co, "Víctor Vendedor", tienda Medellín) para que
  las 18 solicitudes demo tengan creador real por tienda (9 y 9).
  "Mis solicitudes" ahora es literal: el VENDEDOR filtra por `creado_por`,
  el MANAGER por tienda. Backlog saldado (era el ítem "creado_por").
- 2026-07-14 (madrugada): paginación y selector de tamaño generalizados a
  `components/shared/` (`paginacion.tsx` con sustantivo parametrizado,
  `selector-por-pagina.tsx` con nombre de searchParam parametrizado — motos
  usa motoPorPagina/motoPagina, solicitudes usa porPagina/pagina, sin
  colisión). "Mis solicitudes" paginada vía nuevo
  `ReporteriaService.solicitudesPaginadas` ({tiendaId?, creadoPor?, pagina,
  porPagina} → {items, total} con count exacto). Ítem "Buscar cliente"
  agregado al sidebar del vendedor (/buscar ya existía con dos puertas).
  Verificado en navegador: sidebar con 3 ítems, 9 filas propias de
  Valentina, evaluación nueva aparece de primera como "Evaluada" (10
  solicitudes), 103/103 tests, typecheck limpio.
- 2026-07-14: `.playwright-mcp/` (artefactos de verificación en navegador)
  entró por accidente en un `git add .` — revertido, directorio eliminado y
  agregado a `.gitignore`. Commit `3ccd3fc` empuja todo el trabajo del
  módulo catalogo + buscadores + mis solicitudes + trazabilidad.
- 2026-07-14: tabla de solicitudes extraída a componente compartido
  (`components/shared/tabla-solicitudes.tsx`) — la usan "Mis solicitudes"
  (vendedor) y "Resumen de tienda" (manager, paginada por tienda con
  `solicitudesPaginadas`). El manager gana la acción **Reasignar vendedor**
  (ícono UserCog) — por ahora VISUAL (botón deshabilitado, title
  "próximamente"): el flujo real (¿a quién?, ¿evento?, ¿workflow?) queda por
  diseñar con Julián. KPI "Solicitudes" del manager ahora usa el total real
  del count paginado.
- 2026-07-14: búsqueda de clientes extendida a TODOS los roles — el input
  del header ahora es universal (PanelShell sin condicional de rol) y los 5
  sidebars ganan "Buscar cliente". Nuevo route group `(compartido)` (layout
  con `exigirRol` de los 5 roles + PanelShell): ahí viven `/buscar` (movida
  desde (vendedor)) y la NUEVA `/clientes/[cedula]` — la "tabla de casos"
  del cliente. Decisión de UX de Julián: el resultado de la búsqueda abre
  los CASOS del cliente, no el wizard (el wizard se alcanza desde la acción
  "ojo" de cada caso, solo para vendedor/manager). Alcance de datos por rol:
  vendedor/manager solo su tienda (URL ajena = "Cliente no encontrado");
  financiero/contable/ceo nacional. `TablaSolicitudes` gana prop `conWizard`
  (la acción y el CTA de tabla vacía se ocultan a roles sin acceso);
  `solicitudesPaginadas` gana filtro `clienteCedula`. proxy.ts gatea
  `/buscar` y `/clientes` para los 5 roles. Verificado en navegador: CEO
  busca nacional y ve casos SIN wizard; vendedora ve su cliente CON wizard
  y el de otra tienda bloqueado. 103/103 tests, typecheck limpio.
- 2026-07-14: rol MANAGER completado según el prototipo v0, con datos REALES
  (decisión de Julián: funcional, no cosmético):
  (1) Nuevas vistas reporteria (migración `20260714134256`):
  `desempeno_vendedores` (solicitudes/aprobadas por `creado_por` +
  colocación real vía links→creditos), `colocacion_diaria` por tienda, y
  `solicitudes_recientes` gana `moto_nombre`/`vendedor_nombre` (joins
  cross-schema: permitidos en vistas de reporteria).
  (2) `/tienda` estilo v0: KPIs (colocación último año, tasa de aprobación),
  gráfico `ColumnasMensuales` de colocación 12 meses, tabla de desempeño
  por vendedor, y tabla de solicitudes con formato v0 (ID corto de la
  solicitud + Moto + Vendedor — con el ID cada caso es distinguible aunque
  el cliente se repita; el agrupado por persona vive en /clientes/[cedula])
  con búsqueda por cliente/cédula (`solQuery`, mismo saneo anti-inyección
  de filtros PostgREST) y filtro por decisión (`FiltroDecision`).
  (3) NUEVO MÓDULO `agenda` (decisión con Julián: real, no mock en la app):
  schema `agenda.citas` (FKs a public.tiendas/perfiles, `cliente_cedula`
  como referencia suave, RLS por tienda, grants explícitos), dominio puro
  con `crearCita` validado (5 tests → suite 108/108), fachada
  `AgendaService` (crearCita/citasEntre/citasProximas), registrado en
  kernel y bootstrap. Aprendizaje de infraestructura: agregar un schema a
  config.toml ANTES de que exista su migración deja a PostgREST sin
  arrancar (error 3F000 en el health-check) — hay que arrancar sin el
  schema, correr `db reset`, y recién ahí exponerlo + stop/start.
  (4) `/calendario` del manager: grid mensual SSR con colocación real por
  día (chips), totales por semana y KPI del mes (desempeño por día/semana/
  mes en una sola vista), citas de agenda en cada celda, navegación entre
  meses por searchParams y formulario "Nueva cita" (server action →
  fachada; tienda/creador SIEMPRE de la sesión). Verificado: cita creada
  desde la UI aparece en el grid; dic-2025 cuadra al peso ($17,3M = 9,9 +
  7,4 de sus chips diarios).
  (5) Banner recordatorio de citas (48 h) en TODOS los apartados del
  manager: server component `BannerCitas` inyectado vía prop `banner` de
  PanelShell desde el layout (manager); marquee CSS puro (keyframes
  `marquee-citas` añadidos al FINAL de globals.css sin tocar el tema, con
  pausa en hover y respeto de prefers-reduced-motion). Seed de 6 citas con
  fechas relativas a `current_date` (+5h por el offset UTC→Bogotá) para que
  banner y calendario siempre tengan datos en demo.
- 2026-07-14: FIX del scroll horizontal reportado por Julián en el panel del
  manager — DOS causas encadenadas, ambas de flexbox min-content: (1) el
  marquee del banner (`w-max`) propagaba su ancho intrínseco; ahora va
  `position: absolute` dentro de su wrapper (fuera del flujo = cero
  min-content garantizado); (2) el `SidebarInset` de shadcn es un flex item
  SIN `min-w-0`: no podía encogerse por debajo del min-content de su
  contenido y empujaba la página entera en viewports ≤1366px — `min-w-0`
  agregado en PanelShell. REGLA aprendida: todo flex item que contenga
  scroll containers o contenido ancho necesita `min-w-0` explícito.
  Verificado a 1280px en /tienda, /calendario, /hoy y el wizard: cero
  desborde.
- 2026-07-14: FIX del banner que no mostraba la cita creada por Julián —
  DOS causas: (1) la action guardaba la hora local "a secas" y Postgres la
  interpretaba como UTC (cita corrida 5 horas); ahora se convierte con
  `new Date(...).toISOString()` y las citas ya guardadas se corrigieron
  (+5h); (2) el banner recortaba a 48 horas y la cita ("Lanzamiento Moto
  nueva", a 3 días) quedaba fuera — ahora muestra las próximas 6 citas SIN
  ventana y con el día visible ("vie 17, 09:00 a. m.").
- 2026-07-14: sistema de filtros por columna en TODAS las tablas de
  solicitudes (pedido de Julián): componente compartido
  `FiltrosSolicitudes` (decisión, estado, moto, vendedor —solo manager—,
  rango de fechas desde/hasta y botón limpiar; todo narra searchParams) +
  búsqueda multi-columna: `solicitudesPaginadas` ahora busca en
  cliente_nombre, cliente_cedula, moto_nombre, vendedor_nombre y
  solicitud_corta (nueva columna `left(id::text,8)` en la vista, migración
  `20260714144101` — uuid no admite ilike), con el mismo saneo
  anti-inyección de filtros PostgREST. Aplicado en /tienda (con vendedor),
  /solicitudes del vendedor y /clientes/[cedula]. Las opciones de los
  selects son REALES (motos del catálogo, vendedores del desempeño) y
  llegan por props desde el server component.
- 2026-07-14: nueva vista "Hoy" del manager (`/hoy`, primer ítem del
  sidebar, propuesta por Julián): el día de la tienda en una pantalla —
  KPIs (solicitudes/aprobadas/colocación/citas de hoy), agenda del día con
  hora y link a los casos del cliente, y tabla de solicitudes creadas hoy.
  Los límites del día son LOCALES convertidos a instantes UTC.
- 2026-07-14 (cierre de sesión): Julián aceptó las 3 propuestas (meta de
  colocación con progreso, alerta de mora en /hoy, export CSV) y sumó 6
  ideas nuevas: tabla genérica con filtros/búsqueda para cualquier dato,
  filas de desempeño con background de color de avance, bug visual de las
  barras de "Colocación mensual", seguimiento por asesor vs presupuesto,
  impulso de financiación por moto, y canal de comunicación entre roles
  vía Supabase Realtime. Todo registrado en "Siguiente → Backlog acordado
  para la tarde del 2026-07-15". Instrucción explícita: no tocar más
  código en esa sesión. OJO: el trabajo del manager (desde el commit
  3ccd3fc) sigue SIN commitear al cierre — commit b62ade8 lo recogió
  después.
- 2026-07-15 (tarde): FIX de las barras invisibles en "Colocación mensual"
  (reporte de Julián: valor sobre el mes, sin barra). Causa raíz: el
  contenedor del gráfico usa `items-end`, que desactiva el stretch de las
  columnas — cada columna quedaba con altura de contenido y el `height: %`
  de la barra resolvía contra un padre sin altura definida = 0px, sin error
  ni warning. Fix mínimo: altura de barra en PX calculada sobre el área
  fija del gráfico (constante AREA_BARRA en ColumnasMensuales). REGLA: un
  height porcentual exige que TODA la cadena de padres tenga altura
  definida; items-end/start la rompe silenciosamente.
- 2026-07-15 (tarde): DESEMBOLSO desde la UI — decisión de Julián: lo
  dispara el rol FINANCIERO (como en banca; era el candidato anotado).
  Diagnóstico previo: la colocación no se movía porque NADA en la app
  llamaba al workflow `desembolsarCredito` (las solicitudes morían en
  `evaluada`; los 18 créditos eran todos del seed). Implementación:
  (1) originacion expone `paraDesembolso(solicitudId)` — DTO plano con
  cliente/tienda/plazo/monto a financiar (regla de SU dominio) y tasaEA
  del producto (3 tests);
  (2) cartera gana el caso de uso `DesembolsarSolicitudAprobada` (4 tests):
  valida no-existe / no-APROBADA / ya-desembolsada y delega en el workflow
  existente; la fuente se inyecta como CONTRATO en cartera/domain
  (FuenteSolicitudesAprobadas, DIP) y module.ts la resuelve por container
  con provider perezoso — import type-only de originacion/index, runtime
  siempre por container (regla 3). tasaMoraEA = 0.38 constante demo
  (TASA_MORA_EA_DEMO; pasará al producto cuando SUMOTO defina política);
  (3) /cartera (financiero): sección "Pendientes de desembolso" (alcance
  NACIONAL, decision=APROBADO + estado=evaluada) con acción por fila →
  server action que solo manda el ID (fecha en zona America/Bogota — jamás
  toISOString directo, lección de las citas). Suite 115/115.
  VERIFICADO punta a punta en navegador: pendiente listada → clic
  Desembolsar → crédito $8M/24 cuotas hoy, solicitud `desembolsada` (el
  subscriber de originacion oyó el evento), asiento contable generado y
  despachado al mock World Office (WO-000001), "Créditos activos" 18→19 y
  la barra de JULIO apareció en colocación mensual del manager ($8,0M).
- 2026-07-15 (tarde): TABLA GENÉRICA con orden y filtro POR ENCABEZADO
  (idea de Julián: "que los encabezados tengan filtro y sort para evitar
  ponerlo en el header de la tabla y así cada tabla tendrá el mismo
  formato"). Piezas: `TablaDatos` (server component genérico — recibe
  `ColumnaDatos<T>[]` con render, sirve para solicitudes, clientes o lo que
  venga) + `EncabezadoColumna` (client, ÚNICO interactivo: menú por columna
  con Ascendente/Descendente, filtro de opciones o rango de fechas y
  "Limpiar columna"; solo narra searchParams `orden`/`dir` + params de
  filtro existentes). `TablaSolicitudes` quedó como configuración de
  columnas sobre la genérica (mismas acciones por fila). En el core,
  `solicitudesPaginadas` acepta `orden`/`direccion` con WHITELIST de
  columnas (el nombre viaja en la URL: jamás se interpola sin validar) y
  desempate por solicitud_id para paginación estable. `FiltrosSolicitudes`
  ELIMINADO (reemplazado por los encabezados) en /tienda, /solicitudes y
  /clientes/[cedula]; /hoy también quedó cableado (orden y filtros narran,
  el día permanece fijo y sin filtro de fechas: conFiltroFechas={false}).
  Verificado en navegador: orden por valor asc + filtro Decisión=Aprobadas
  combinados en la URL, paginación conserva orden/dir, cero scroll
  horizontal a 1280px.
- 2026-07-15 (tarde): FIX zona horaria en /hoy — la tabla de solicitudes
  del día filtraba con fecha PLANA (yyyy-mm-dd) contra `creado_en`
  timestamptz: una solicitud de las 8 p. m. de Bogotá ya es "mañana" en UTC
  y desaparecía de "Hoy". Ahora usa los mismos INSTANTES (inicioDia/finDia)
  que ya calculaba para las citas. Misma familia del bug del banner:
  timestamps siempre como instantes con zona, nunca fechas a secas.
- 2026-07-16: FILTROS GENÉRICOS POR MAPA DE ESTRATEGIAS en reporteria
  (idea de Julián: "convertir recaudoMensual en un método que aplique
  filtros de manera genérica mediante un mapa de estrategias"). Cada vista
  tiene su interface de filtros (`FiltrosRecaudoMensual`,
  `FiltrosSolicitudes`) y su mapa (`MAPA_FILTROS_RECAUDO`,
  `MAPA_FILTROS_SOLICITUDES`) en `reporteria/service.ts`; el mapped type
  `MapaFiltros<F>` obliga a que interface y mapa no se desincronicen, y el
  mapa ES la whitelist (clave desconocida de la URL se ignora). Helpers
  reutilizables: `filtroTexto` (ilike con saneo anti-inyección PostgREST),
  `filtroNumero` ("op:valor", op ∈ eq|gt|gte|lt|lte, NaN se ignora),
  `filtroFechaDesde/Hasta` (rango inclusivo — `diaSiguiente` ahora en
  core/shared/dates, las páginas ya no lo calculan), `filtroIgual`.
  Los tipos se DEFINEN en el core (junto al mapa, su fuente de verdad) y
  packages/contracts/dtos/reporteria.ts los RE-EXPORTA: definirlos en
  contracts invertía la flecha contracts→core (contracts ya importa
  esCedulaValida del core). `solicitudesPaginadas` conserva
  `desdeFecha/hastaFecha` como ALCANCE crudo (el /hoy fija el día como
  instantes), separado del filtro de columna desde/hasta.
- 2026-07-16: TablaDatos ganó encabezado propio — prop `titulo`
  (font-headline text-3xl) + prop `busqueda` (InputBusqueda enfrentado con
  justify-between; decisión de Julián). El encabezado vive FUERA del
  early-return de vacío: sin filas, el input sigue visible para corregir la
  búsqueda. Los encabezados de columna dejaron el look badge por el patrón
  de marco del proyecto (border-b negro fijo → marco entero en hover, solo
  transiciona color). `EncabezadoColumna` ganó tipos de filtro `texto`
  (input con debounce 400ms) y `numero` (select de operador ≥ > = ≤ < +
  valor + OK; `factor: 100` = el usuario escribe PESOS y la URL narra
  CENTAVOS — la conversión muere en la UI), y `paramOrden`/`paramDir`
  configurables para que dos tablas de una misma página no se pisen.
- 2026-07-16: REFACTOR DE TABLAS CONCLUIDO — las 5 vistas de solicitudes
  usan TablaDatos directo: /solicitudes (vendedor), /tienda y /hoy
  (manager, /hoy ganó opciones de moto/vendedor y búsqueda),
  /clientes/[cedula] (ganó búsqueda) y "Pendientes de desembolso" en
  /cartera (ganó búsqueda `desQuery`, orden propio `penOrden`/`penDir`,
  columnas decisión/estado OCULTAS porque son criterio fijo de la cola y
  se fuerzan DESPUÉS del spread para que la URL no las pise).
  `tabla-solicitudes.tsx` BORRADO; lo reemplaza
  `components/shared/columnas-solicitudes.tsx` (builder de config pura
  `columnasSolicitudes(opciones)` — CADA columna declara su filtro).
  Patrón de fetch resultante: catálogo/desempeño se consultan ANTES que
  las solicitudes (las columnas necesitan las opciones para sus filtros y
  crearTableQuery lee las columnas) — waterfall de 2 tandas aceptado.
  "Recaudo por mes" (/cartera): filtros en las 6 columnas (mes por rango
  mesDesde/mesHasta, resto numéricos con comparador). Verificado en
  navegador con los 3 roles: valor=gte:1200000000, cliente=luisa,
  pagos=gte:15 + orden asc. Suite 115/115, tsc limpio.
- 2026-07-16: BUG CAZADO en la verificación — `?vendedor=basura` daba 500:
  `creado_por` es uuid y PostgREST rechaza un eq con valor malformado. La
  estrategia `vendedor` ahora valida forma UUID antes de aplicar. REGLA:
  todo valor de searchParams que aterrice en una columna tipada (uuid,
  date, numeric) valida su FORMA en la estrategia; garbage se ignora,
  jamás revienta la página.
- 2026-07-16 (cierre): DECISIÓN de Julián — el input de búsqueda debe
  estar EN TODAS las tablas y debe poder buscar EN CUALQUIER COLUMNA
  (también numéricas y fechas). Contexto: "Recaudo por mes" quedó sin
  búsqueda porque no tiene columnas de texto y `recaudoMensual()` no tenía
  `query` — el input NO está condicionado por tipos dentro de TablaDatos,
  es opt-in vía prop `busqueda`, simplemente no se le pasó. Queda para
  mañana (ver Siguiente). Fix aplicado en la misma sesión: el subtítulo de
  "Pendientes de desembolso" pasó de inline a bloque — un título largo
  empujaba el input de búsqueda a la línea de abajo con flex-wrap.
- 2026-07-17 (mañana): BÚSQUEDA EN TODAS LAS TABLAS SOBRE CUALQUIER COLUMNA
  (opción A — mapas de búsqueda por vista, hermanos de los mapas de filtro).
  La maquinaria genérica salió de service.ts a
  `reporteria/filtros.ts` (interna del módulo, con 14 unit tests de los
  builders puros — suite 129/129): estrategias `buscaTexto` (ilike),
  `buscaNumero` (con factor pesos→centavos) y `buscaFecha` ("2026"→año,
  "2026-07"→mes, "2026-07-15"→día; rangos con and() anidado en el or() de
  PostgREST). Un término aporta condición SOLO en las columnas cuyo tipo lo
  acepta; si ninguna lo acepta, resultado vacío. Cuatro mapas:
  BUSQUEDA_RECAUDO, BUSQUEDA_SOLICITUDES (absorbe el or() manual que
  existía — ahora también busca por monto y fecha), BUSQUEDA_ASIENTOS y
  BUSQUEDA_CARTERA_TIENDA. LECCIÓN de la verificación E2E: el eq exacto en
  dinero casi nunca matchea — la UI muestra Math.round(centavos/100), así
  que el usuario busca lo que VE: buscaNumero con factor>1 matchea el rango
  de centavos que REDONDEA al peso escrito ([t·100−50, t·100+50); caso
  real: 277873060 se muestra $2.778.731 y debía matchear).
- 2026-07-17 (mañana): vista CONTABLE completada al patrón — filtros en
  las 6 columnas (descripción texto, débito/crédito numéricos, origen/
  despacho opciones, fecha rango con lte por ser date plana) vía
  MAPA_FILTROS_ASIENTOS + FiltrosAsientos, búsqueda `asiQuery`, título 3xl.
  Vista CEO estrenó tabla: "Cartera por tienda" pasó de barras a TablaDatos
  (tienda/créditos/cartera/vencida, orden con whitelist, filtros por
  columna, búsqueda `tiendaQuery`) — `carteraPorTienda()` ganó
  query/orden/filtros retrocompatibles (el /tienda del manager la sigue
  llamando sin argumentos). FiltrosAsientos y FiltrosCarteraTienda
  exportados por el módulo y re-exportados por contracts. Verificado en
  navegador con los 4 roles: recQuery=2026-07 y recQuery=2778731 (monto tal
  como se ve), asiQuery=desembolso, tiendaQuery=norte,
  solQuery=12000000 (solicitudes por monto). tsc limpio.
- 2026-07-17 (mediodía): META DE COLOCACIÓN por tienda — migración
  `20260716153640_tiendas_meta_colocacion`: columna
  `meta_colocacion_centavos` en public.tiendas (dato organizacional, como
  perfiles) expuesta por la vista `cartera_por_tienda` (columna nueva AL
  FINAL: create or replace view no reordena columnas); metas demo $25M
  Bogotá / $20M Medellín, también en seed.sql para sobrevivir db reset.
  UI: BarraHorizontal en la tarjeta "Colocación mensual" de /tienda con el
  mes corriente vs meta (verde al 100%+). Verificado: "Meta jul. $14,3M de
  $25,0M · 57%". Aplicada con `pnpm supabase migration up` (sin reset: los
  datos de demo del desembolso sobreviven).
- 2026-07-17 (mediodía): ALERTA DE MORA en /hoy — banner ámbar bajo el
  header si la tienda del manager carga capital vencido (dato de
  cartera_por_tienda, % sobre el saldo). Verificado: "$24,4M en cartera
  vencida (43% del saldo)".
- 2026-07-17 (mediodía): EXPORTAR CSV RESPETANDO FILTROS ACTIVOS —
  `lib/csv.ts` (RFC 4180: CRLF, comillas dobladas, BOM UTF-8 para Excel;
  `pesosCsv` exporta pesos con 2 decimales — el CSV conserva el centavo
  que la UI redondea) + 3 route handlers delgados (guarda de rol →
  fachada → serializar): `/solicitudes/exportar` (vendedor Y manager, el
  ALCANCE se re-aplica en la ruta por sesión — jamás se confía en la URL),
  `/contabilidad/exportar` (contable) y `/cartera/exportar-recaudo`
  (financiero). Los filtros de la URL pasan CRUDOS a la fachada: el mapa
  de estrategias del core es la whitelist (crearTableQuery es cortesía de
  la UI, no la frontera). `TablaDatos` ganó prop `exportarHref` (botón CSV
  junto a la búsqueda, patrón de subrayado) y `hrefConParams()` en
  lib/tabla.query.ts arrastra los searchParams vigentes. Los layouts NO
  protegen route handlers → cada ruta llama exigirRol (dos puertas).
  Verificado con descargas reales: solicitudes con decision=APROBADO+orden
  desc, recaudo con pagos=gte:15, asientos con origen=desembolso.
- (agregar nuevas decisiones aquí con fecha)
