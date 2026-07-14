// E2E TEMPORAL contra Supabase local: flujo completo de negocio.
// escanear cédula → registrar cliente → evaluar (APROBADO) → desembolsar
// (workflow) → pagar (workflow) → asientos contables por eventos.
// Se ejecuta manualmente: npx vitest run flow.e2e.test.ts

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { CarteraService } from "./modules/cartera/index";
import type { CatalogoService } from "./modules/catalogo/index";
import type { ClientesService } from "./modules/clientes/index";
import type { OriginacionService } from "./modules/originacion/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const TIENDA = "11111111-1111-4111-8111-111111111111";
// último dígito 8 → score alto (APROBADO); penúltimo 4 → sin mora en buró
const CEDULA = "1099999948";

describe("flujo completo de negocio contra Supabase local", () => {
  it("escaneo → decisión → desembolso → pago → asientos", async () => {
    arrancarNucleo({ supabase });
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const originacion = resolver<OriginacionService>(TOKENS.originacionService);
    const cartera = resolver<CarteraService>(TOKENS.carteraService);
    const catalogo = resolver<CatalogoService>(TOKENS.catalogoService);

    // 1. registrar cliente vía escáner mock
    const registro = await clientes.registrarCliente({
      fuente: "escaner",
      entradaCruda: { codigo: CEDULA },
      ingresosDeclaradosCentavos: 300_000_000,
      tiendaId: TIENDA,
    });
    expect(registro.ok).toBe(true);
    if (!registro.ok) return;
    const cliente = registro.valor;

    // 2. evaluar solicitud (producto Moto Fácil y una moto cualquiera del seed)
    const productos = await originacion.listarProductosActivos();
    const producto = productos.find((p) => p.nombre === "Moto Fácil")!;
    const { items: motos } = await catalogo.buscarMotos({ pagina: 1, porPagina: 1 });
    const evaluacion = await originacion.evaluarSolicitud({
      clienteId: cliente.id!,
      cedula: CEDULA,
      productoId: producto.id,
      motoId: motos[0].id,
      tiendaId: TIENDA,
      // Valentina Vendedora (seed) — el perfil FK exige un usuario real
      creadoPor: "a0000000-0000-4000-8000-000000000001",
      valorMotoCentavos: 800_000_000,
      cuotaInicialCentavos: 200_000_000,
      plazoMeses: 24,
      ingresosDeclaradosCentavos: 300_000_000,
    });
    expect(evaluacion.ok).toBe(true);
    if (!evaluacion.ok) return;
    expect(evaluacion.valor.decision.resultado).toBe("APROBADO");
    const solicitudId = evaluacion.valor.solicitud.id!;

    // 3. desembolsar (workflow: crédito + 24 cuotas + link + evento)
    const desembolso = await cartera.desembolsarCredito({
      solicitudId,
      clienteId: cliente.id!,
      tiendaId: TIENDA,
      montoCentavos: 600_000_000,
      tasaEA: producto.tasaEA,
      tasaMoraEA: 0.38,
      plazoMeses: 24,
      fechaDesembolso: new Date().toISOString().slice(0, 10),
    });
    expect(desembolso.ok).toBe(true);
    if (!desembolso.ok) return;
    expect(desembolso.valor.cuotas).toHaveLength(24);
    const creditoId = desembolso.valor.credito.id!;
    // la cuota del plan == la cuota prometida en la decisión
    expect(desembolso.valor.credito.cuotaCentavos).toBe(
      evaluacion.valor.decision.cuotaEstimadaCentavos,
    );

    // 4. pagar la primera cuota (workflow de pago)
    const pago = await cartera.registrarPago({
      creditoId,
      montoCentavos: desembolso.valor.credito.cuotaCentavos,
      fechaPago: new Date().toISOString().slice(0, 10),
    });
    expect(pago.ok).toBe(true);

    // dar un respiro a los subscribers asíncronos
    await new Promise((r) => setTimeout(r, 500));

    // 5. verificar efectos entre módulos (vía eventos, sin imports cruzados):
    //    - originación marcó su solicitud desembolsada
    const { data: solicitud } = await supabase
      .schema("originacion")
      .from("solicitudes")
      .select("estado")
      .eq("id", solicitudId)
      .single();
    expect(solicitud?.estado).toBe("desembolsada");

    //    - contabilidad generó 2 asientos cuadrados (desembolso + pago)
    const { data: asientos } = await supabase
      .schema("contabilidad")
      .from("asientos")
      .select("id, evento_origen, despacho, partidas:partidas(debito_centavos, credito_centavos)")
      .in("referencia_id", [creditoId, pago.ok ? pago.valor.pago.id! : ""]);
    expect(asientos).toHaveLength(2);
    for (const asiento of asientos ?? []) {
      const debitos = asiento.partidas.reduce((s, p) => s + p.debito_centavos, 0);
      const creditos = asiento.partidas.reduce((s, p) => s + p.credito_centavos, 0);
      expect(debitos).toBe(creditos);
      expect(asiento.despacho).toBe("despachado"); // World Office mock respondió
    }

    //    - el link solicitud↔crédito existe
    const { data: link } = await supabase
      .schema("links")
      .from("solicitud_credito")
      .select()
      .eq("solicitud_id", solicitudId)
      .single();
    expect(link?.credito_id).toBe(creditoId);
  }, 30_000);
});
