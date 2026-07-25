// Aislamiento entre tenants (empresas): la fuga de datos entre
// empresas-cliente es el riesgo más grave del pivote multi-tenant — este
// test NUNCA debe fallar. Se corre manualmente contra Supabase local:
// npx vitest run aislamiento-tenant.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { arrancarNucleo } from "./bootstrap";
import { resolver, TOKENS } from "./kernel/container";
import type { ClientesService } from "./modules/clientes/index";

const supabase = createClient(
  "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const EMPRESA_SUMOTO = "d0000000-0000-4000-8000-000000000001";
const TIENDA_SUMOTO = "11111111-1111-4111-8111-111111111111";
const CEDULA_COMPARTIDA = "1099999977"; // misma cédula en las dos empresas a propósito

describe("aislamiento entre empresas (tenants)", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let clienteRival: string;

  beforeAll(async () => {
    arrancarNucleo({ supabase });

    const { data: empresa, error: errEmpresa } = await supabase
      .from("empresas")
      .insert({ nombre: "Rival S.A.S.", slug: "rival-sas" })
      .select("id")
      .single();
    if (errEmpresa) throw errEmpresa;
    empresaRival = empresa.id;

    const { data: tienda, error: errTienda } = await supabase
      .from("tiendas")
      .insert({ nombre: "Rival Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    if (errTienda) throw errTienda;
    tiendaRival = tienda.id;

    const { data: cliente, error: errCliente } = await supabase
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: CEDULA_COMPARTIDA,
        nombres: "Ricardo",
        apellidos: "Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();
    if (errCliente) throw errCliente;
    clienteRival = cliente.id;
  });

  it("buscarPorCedula de SUMOTO nunca ve al cliente de la empresa rival", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const encontrado = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, EMPRESA_SUMOTO);
    expect(encontrado).toBeNull();
  });

  it("buscarPorId de SUMOTO nunca ve al cliente de la empresa rival", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const encontrado = await clientes.buscarPorId(clienteRival, EMPRESA_SUMOTO);
    expect(encontrado).toBeNull();
  });

  it("buscarClientes de SUMOTO nunca incluye clientes de la empresa rival", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const resultados = await clientes.buscarClientes("Rival", EMPRESA_SUMOTO);
    expect(resultados.find((c) => c.id === clienteRival)).toBeUndefined();
  });

  it("buscarPorCedula de la empresa rival SÍ ve a su propio cliente", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const encontrado = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, empresaRival);
    expect(encontrado?.id).toBe(clienteRival);
  });

  it("un cliente con la MISMA cédula puede existir en dos empresas distintas", async () => {
    const clientes = resolver<ClientesService>(TOKENS.clientesService);
    const deSumoto = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, EMPRESA_SUMOTO);
    expect(deSumoto).toBeNull(); // SUMOTO no sembró esta cédula en su seed
    const deRival = await clientes.buscarPorCedula(CEDULA_COMPARTIDA, empresaRival);
    expect(deRival).not.toBeNull();
  });
});
