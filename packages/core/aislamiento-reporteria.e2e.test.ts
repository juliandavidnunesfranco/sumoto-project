// Aislamiento entre tenants para reporteria — a nivel de REPOSITORIO
// (ReporteriaService filtra por empresa_id explícito), NO a nivel RLS:
// cartera.creditos/originacion.solicitudes todavía no tienen empresa_id
// propio (fase 2 pendiente) — ver spec 2026-07-26-reporteria-empresa-id-design.md
// sección 3. Se corre manualmente:
// npx vitest run aislamiento-reporteria.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { ReporteriaService } from "./modules/reporteria/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const EMPRESA_SUMOTO = "d0000000-0000-4000-8000-000000000001";
const SUFIJO = Date.now().toString(36);

describe("aislamiento entre empresas — reporteria (filtro de repositorio)", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let creditoRival: string;

  beforeAll(async () => {
    arrancarNucleo({ supabase });

    const { data: empresa, error: errEmpresa } = await supabase
      .from("empresas")
      .insert({ nombre: "Rival Reporteria S.A.S.", slug: `rival-reporteria-${SUFIJO}` })
      .select("id")
      .single();
    if (errEmpresa) throw errEmpresa;
    empresaRival = empresa.id;

    const { data: tienda, error: errTienda } = await supabase
      .from("tiendas")
      .insert({ nombre: "Rival Reporteria Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    if (errTienda) throw errTienda;
    tiendaRival = tienda.id;

    const { data: cliente, error: errCliente } = await supabase
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: `21${Date.now().toString().slice(-8)}`,
        nombres: "Rita",
        apellidos: "Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();
    if (errCliente) throw errCliente;

    const { data: credito, error: errCredito } = await supabase
      .schema("cartera")
      .from("creditos")
      .insert({
        cliente_id: cliente.id,
        tienda_id: tiendaRival,
        monto_desembolsado_centavos: 500_000_000,
        tasa_ea: 0.245,
        tasa_mora_ea: 0.38,
        plazo_meses: 12,
        cuota_centavos: 47_000_000,
        desembolsado_en: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (errCredito) throw errCredito;
    creditoRival = credito.id;

    const { error: errCuota } = await supabase
      .schema("cartera")
      .from("cuotas")
      .insert({
        credito_id: creditoRival,
        numero: 1,
        fecha_vencimiento: new Date().toISOString().slice(0, 10),
        capital_centavos: 40_000_000,
        interes_centavos: 7_000_000,
      });
    if (errCuota) throw errCuota;

    // solicitud propia (para probar solicitudesPaginadas) — producto_id y
    // moto_id referencian filas del seed de SUMOTO a propósito: ni
    // productos de crédito ni el catálogo de motos están acotados por
    // empresa todavía (fuera de alcance de este plan), así que cualquier
    // fila activa sirve como fixture. moto_id no tiene UUID fijo en el
    // seed (se genera con gen_random_uuid()) — hay que resolverlo en
    // tiempo de ejecución, no se puede hardcodear. creado_por reutiliza el
    // usuario vendedor real de SUMOTO (misma referencia cruzada que ya
    // usa flow.e2e.test.ts): la FK exige un auth.users real, y esto no
    // afecta el aislamiento que se está probando (creado_por no participa
    // en el filtro de empresa_id).
    const { data: motoCualquiera, error: errMoto } = await supabase
      .schema("catalogo")
      .from("motos")
      .select("id")
      .limit(1)
      .single();
    if (errMoto) throw errMoto;

    const { error: errSolicitud } = await supabase
      .schema("originacion")
      .from("solicitudes")
      .insert({
        cliente_id: cliente.id,
        producto_id: "bbbbbbbb-0000-4000-8000-000000000001",
        moto_id: motoCualquiera.id,
        tienda_id: tiendaRival,
        valor_moto_centavos: 800_000_000,
        cuota_inicial_centavos: 200_000_000,
        plazo_meses: 24,
        ingresos_declarados_centavos: 300_000_000,
        estado: "desembolsada",
        creado_por: "a0000000-0000-4000-8000-000000000001",
      });
    if (errSolicitud) throw errSolicitud;
  });

  it("SUMOTO nunca ve la cartera por tienda de la empresa rival", async () => {
    const reporteria = resolver<ReporteriaService>(TOKENS.reporteriaService);
    const porTienda = await reporteria.carteraPorTienda(EMPRESA_SUMOTO);
    expect(porTienda.find((t) => t.tienda_id === tiendaRival)).toBeUndefined();
  });

  it("SUMOTO nunca ve solicitudes de la empresa rival", async () => {
    const reporteria = resolver<ReporteriaService>(TOKENS.reporteriaService);
    const { items } = await reporteria.solicitudesPaginadas(EMPRESA_SUMOTO, {
      tiendaId: tiendaRival,
      pagina: 1,
      porPagina: 10,
    });
    // el filtro de empresa_id se aplica ANTES que tiendaId: aunque se pida
    // explícitamente la tienda rival, SUMOTO no puede verla — cero filas,
    // no un error, prueba que empresa_id gana sobre cualquier otro filtro.
    expect(items).toHaveLength(0);
  });

  it("la empresa rival SÍ ve su propia cartera por tienda y sus solicitudes", async () => {
    const reporteria = resolver<ReporteriaService>(TOKENS.reporteriaService);

    const porTienda = await reporteria.carteraPorTienda(empresaRival);
    const filaRival = porTienda.find((t) => t.tienda_id === tiendaRival);
    expect(filaRival).toBeDefined();
    expect(filaRival?.capital_total_centavos).toBeGreaterThan(0);

    const { items } = await reporteria.solicitudesPaginadas(empresaRival, {
      tiendaId: tiendaRival,
      pagina: 1,
      porPagina: 10,
    });
    expect(items).toHaveLength(1);
  });
});
