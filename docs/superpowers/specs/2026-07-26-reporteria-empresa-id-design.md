# Diseño: `reporteria` con `empresa_id`

- Fecha: 2026-07-26
- Estado: aprobado por Julián, pendiente de plan de implementación
- Contexto: fuga latente encontrada por el review final de la fase 1 de
  multi-tenencia — `reporteria` expone datos de cliente/cartera entre
  empresas sin `empresa_id`, corriendo en `service_role` (bypassa RLS).
  Registrada en `docs/STATUS.md` como pendiente propio, tamaño de módulo
  completo.

## 1. Alcance

**Dentro:** las 8 de 9 vistas/métodos de `reporteria` que tienen un
camino existente a `empresa_id` vía `tienda_id → public.tiendas.empresa_id`:
`cartera_por_credito`, `mora_por_franja`, `resumen_cartera`,
`recaudo_mensual`, `cartera_por_tienda`, `solicitudes_recientes`,
`desempeno_vendedores`, `colocacion_diaria`. Los 8 métodos
correspondientes de `ReporteriaService`. Los 12 call sites del backoffice
que los consumen.

**Fuera (decisión explícita de Julián, 2026-07-26):** `asientos_recientes`
— viene de `contabilidad.asientos`, que hoy no tiene `tienda_id` ni
`empresa_id` en absoluto. Cerrarlo correctamente exige que `cartera`
incluya `empresaId` en los eventos `cartera.credito.desembolsado`/
`cartera.pago.registrado` (tocando `ComandoDesembolsarCredito`/
`ComandoRegistrarPago` y sus call sites de desembolso/pago) — eso es
una porción real de la fase 2 de `cartera`, no un ajuste aislado de
`contabilidad`. Queda documentado como gap conocido (hoy inofensivo, una
sola empresa) para resolverse DENTRO del plan de fase 2 de
`cartera`+`contabilidad`, no en este.

## 2. Por qué `security_invoker` no alcanza

Las vistas de `reporteria` usan `with (security_invoker = true)`, pero
`ReporteriaService` consulta con el cliente `service_role`, que tiene
`BYPASSRLS` a nivel de Postgres — `security_invoker` no cambia eso. El
aislamiento real, igual que en `clientes` (fase 1), tiene que vivir en
`ReporteriaService` como filtro explícito. Esto NO es una regresión de
diseño nueva — es el mismo patrón de dos puertas ya establecido, aplicado
a un módulo de solo lectura.

## 3. Limitación real a documentar, no ocultar

Las tablas de origen (`cartera.creditos`, `cartera.pagos`,
`originacion.solicitudes`) todavía NO tienen `empresa_id` propio (fase 2
pendiente) ni RLS que lo conozca. Esto significa que, a diferencia de
`clientes` (que sí tiene la segunda puerta RLS probada en
`aislamiento-rls.e2e.test.ts`), **`reporteria` en este plan solo tiene
UNA puerta real: el filtro de `ReporteriaService`.** El test de este plan
prueba esa puerta (patrón `aislamiento-tenant`, no `aislamiento-rls`) — y
la spec lo dice explícitamente para que nadie asuma una protección RLS
que no existe todavía.

## 4. Diseño de las vistas

Patrón repetido en las 8: agregar `join public.tiendas t on t.id = ...`
sobre la tabla que ya tiene `tienda_id`, y exponer `t.empresa_id`. Donde
la vista agrega (`GROUP BY`), `empresa_id` entra al agrupado — las vistas
que hoy devuelven una sola fila global (`resumen_cartera`) o agrupada solo
por un criterio (`mora_por_franja` por franja, `recaudo_mensual` por mes)
pasan a devolver una fila POR EMPRESA (y `ReporteriaService` filtra la que
corresponde con `.eq("empresa_id", empresaId).single()` donde aplica).

Ejemplo (`cartera_por_tienda`, la más simple — ya joinea `tiendas`
directo):

```sql
create or replace view reporteria.cartera_por_tienda
  with (security_invoker = true) as
select
  t.id as tienda_id,
  t.empresa_id,
  t.nombre as tienda_nombre,
  count(cc.credito_id) as creditos_activos,
  coalesce(sum(cc.capital_pendiente_centavos), 0)::bigint as capital_total_centavos,
  coalesce(sum(cc.capital_pendiente_centavos) filter (where cc.dias_mora > 0), 0)::bigint
    as capital_vencido_centavos
from public.tiendas t
left join reporteria.cartera_por_credito cc on cc.tienda_id = t.id
group by t.id, t.empresa_id, t.nombre;
```

`cartera_por_credito` es la vista BASE de la que heredan `mora_por_franja`
y `resumen_cartera` — agregarle `empresa_id` (vía join a `tiendas`) hace
que las dos hereden la columna automáticamente al construirse sobre ella;
solo necesitan sumar `empresa_id` a su propio `GROUP BY`/`SELECT`.

## 5. Diseño de `ReporteriaService`

`empresaId: string` como PRIMER parámetro obligatorio en los 8 métodos
(nunca opcional — cruzar el límite de empresa nunca es legítimo, mismo
principio que en `clientes`), con `.eq("empresa_id", empresaId)` agregado
a cada consulta. Ejemplo:

```typescript
async carteraPorTienda(
  empresaId: string,
  opciones?: { query?: string; orden?: string; direccion?: "asc" | "desc"; filtros?: FiltrosCarteraTienda },
): Promise<CarteraPorTienda[]> {
  let consulta: ConsultaVista = this.supabase
    .schema("reporteria")
    .from("cartera_por_tienda")
    .select()
    .eq("empresa_id", empresaId);
  // ...resto del método sin cambios de lógica...
}
```

Los métodos que hoy tienen `tiendaId`/otros filtros como parámetro
posicional (`desempenoVendedores(tiendaId)`, `colocacionDiaria(tiendaId,
desde, hasta)`) pasan `empresaId` ANTES: `desempenoVendedores(empresaId,
tiendaId)`, etc. — mismo criterio que ya se usó para `buscarClientes(query,
empresaId, tiendaId?)` en fase 1: `empresaId` siempre primero y siempre
obligatorio, `tiendaId` después (obligatorio u opcional según el método).

`asientosRecientes` queda intacto — no se toca en este plan.

## 6. Call sites del backoffice

12 archivos llaman `reporteriaService()`. Cada uno necesita threading de
`sesion.empresaId` (ya disponible desde fase 1, `Sesion extends Perfil`)
igual que se hizo con `ClientesService`. El plan de implementación los
enumera uno por uno con el before/after exacto — no se listan aquí para
no duplicar (y arriesgar quedar desactualizados frente al código real al
momento de escribir el plan).

## 7. Testing

Suite `aislamiento-reporteria.e2e.test.ts`, mismo patrón que
`aislamiento-tenant.e2e.test.ts` (fixture de empresa rival vía
`service_role`, aserciones negativas contra `ReporteriaService`
resuelto del container real — NO un test a nivel RLS, ver sección 3).
Cobertura mínima: `carteraPorTienda`, `resumenCartera` y
`solicitudesRecientes` de la empresa rival nunca aparecen al consultar
como SUMOTO, y viceversa.

## 8. Migración de datos existentes

Ninguna — SUMOTO ya tiene `empresa_id` en `tiendas` desde la fase 1; las
vistas nuevas heredan el valor correcto automáticamente vía el join, sin
tocar datos.

## 9. Riesgos y decisiones pendientes (fuera de esta spec)

- `asientos_recientes` — gap documentado, se cierra con la fase 2 de
  `cartera`+`contabilidad` (sección 1).
- Cuando `cartera`/`originacion` ganen `empresa_id` propio en fase 2, vale
  la pena revisar si estas 8 vistas deberían simplificarse para leer
  `empresa_id` directo de esas tablas en vez de vía join a `tiendas` —
  no es necesario ahora, el join funciona correctamente, es una
  optimización futura opcional.

## 10. Próximos pasos

Alcance acotado y con una sola pieza de ambigüedad ya resuelta
(`asientos_recientes` fuera) — pasa directo a `superpowers:writing-plans`
para un plan de implementación, probablemente subagent-driven-development
dado el tamaño (8 vistas + 8 métodos + 12 call sites + test nuevo).
