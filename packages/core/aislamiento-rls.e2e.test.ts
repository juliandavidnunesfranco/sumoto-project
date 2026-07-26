// Aislamiento entre tenants a nivel de POLÍTICA RLS (no del repositorio —
// ver aislamiento-tenant.e2e.test.ts para eso). Este test usa la llave
// anon + login real (signInWithPassword), el mismo camino que usa
// producción (proxy.ts / lib/auth.ts) — no es un atajo de prueba.
// Se corre manualmente: npx vitest run aislamiento-rls.e2e.test.ts --config vitest.e2e.config.ts

import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const URL_SUPABASE = "http://127.0.0.1:54321";

// Cliente legítimo del seed de SUMOTO — cédula 1000000002 (i=2, par), que
// según el loop de supabase/seed.sql cae en tienda 11111111-1111-4111-8111-111111111111
// (la de vendedor@sumoto.co), empresa d0000000-0000-4000-8000-000000000001.
// Verificado contra la base local antes de fijarlo aquí (no es un valor adivinado).
const CEDULA_PROPIA_VENDEDOR = "1000000002";

const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const SUFIJO = Date.now().toString(36); // único por corrida, para slug (sí admite letras)
const CEDULA_RIVAL = `20${Date.now().toString().slice(-8)}`; // 10 dígitos, solo numérico (formato cédula real)

describe("aislamiento entre empresas — política RLS (usuario autenticado real)", () => {
  let empresaRival: string;
  let tiendaRival: string;
  let clienteRival: string;

  beforeAll(async () => {
    const { data: empresa, error: errEmpresa } = await admin
      .from("empresas")
      .insert({ nombre: "Rival RLS S.A.S.", slug: `rival-rls-${SUFIJO}` })
      .select("id")
      .single();
    if (errEmpresa) throw errEmpresa;
    empresaRival = empresa.id;

    const { data: tienda, error: errTienda } = await admin
      .from("tiendas")
      .insert({ nombre: "Rival RLS Centro", ciudad: "Cali", empresa_id: empresaRival })
      .select("id")
      .single();
    if (errTienda) throw errTienda;
    tiendaRival = tienda.id;

    const { data: cliente, error: errCliente } = await admin
      .schema("clientes")
      .from("clientes")
      .insert({
        cedula: CEDULA_RIVAL,
        nombres: "Roberto",
        apellidos: "RLS-Rival",
        fuente_identidad: "entrada_manual",
        tienda_id: tiendaRival,
        empresa_id: empresaRival,
      })
      .select("id")
      .single();
    if (errCliente) throw errCliente;
    clienteRival = cliente.id;
  });

  it("un vendedor autenticado de SUMOTO nunca ve al cliente de la empresa rival vía RLS", async () => {
    const anon = createClient(URL_SUPABASE, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: errLogin } = await anon.auth.signInWithPassword({
      email: "vendedor@sumoto.co",
      password: "sumoto123",
    });
    expect(errLogin).toBeNull();

    const { data: porId, error: errPorId } = await anon
      .schema("clientes")
      .from("clientes")
      .select("id")
      .eq("id", clienteRival)
      .maybeSingle();
    expect(errPorId).toBeNull();
    expect(porId).toBeNull();

    const { data: porCedula, error: errPorCedula } = await anon
      .schema("clientes")
      .from("clientes")
      .select("id")
      .eq("cedula", CEDULA_RIVAL)
      .maybeSingle();
    expect(errPorCedula).toBeNull();
    expect(porCedula).toBeNull();

    const { data: tiendasVisibles, error: errTiendas } = await anon.from("tiendas").select("id");
    expect(errTiendas).toBeNull();
    expect(tiendasVisibles?.some((t) => t.id === tiendaRival)).toBe(false);
  });

  // Control positivo (mismo patrón que aislamiento-tenant.e2e.test.ts, caso
  // "SÍ ve a su propio cliente"): si las aserciones .toBeNull() de arriba
  // pasaran por un query roto (permisos revocados, sesión inválida, etc.)
  // en vez de por el filtro RLS correcto, este caso lo delataría — un
  // vendedor SIEMPRE debe poder ver un cliente legítimo de su propia tienda.
  it("un vendedor autenticado de SUMOTO SÍ ve a un cliente legítimo de su propia tienda", async () => {
    const anon = createClient(URL_SUPABASE, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: errLogin } = await anon.auth.signInWithPassword({
      email: "vendedor@sumoto.co",
      password: "sumoto123",
    });
    expect(errLogin).toBeNull();

    const { data: porCedula, error: errPorCedula } = await anon
      .schema("clientes")
      .from("clientes")
      .select("id, cedula")
      .eq("cedula", CEDULA_PROPIA_VENDEDOR)
      .maybeSingle();
    expect(errPorCedula).toBeNull();
    expect(porCedula?.cedula).toBe(CEDULA_PROPIA_VENDEDOR);
  });

  // Rol de alcance nacional: para financiero/contable/ceo la política
  // colapsa a `empresa_id = empresa_actual() and rol_actual() is not null`
  // — tienda_actual() es null, así que NO hay respaldo del filtro de tienda.
  // Este caso aísla específicamente la cláusula empresa_id.
  it("un financiero autenticado (rol nacional, sin tienda) nunca ve al cliente de la empresa rival vía RLS", async () => {
    const anon = createClient(URL_SUPABASE, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: errLogin } = await anon.auth.signInWithPassword({
      email: "financiero@sumoto.co",
      password: "sumoto123",
    });
    expect(errLogin).toBeNull();

    const { data: porId, error: errPorId } = await anon
      .schema("clientes")
      .from("clientes")
      .select("id")
      .eq("id", clienteRival)
      .maybeSingle();
    expect(errPorId).toBeNull();
    expect(porId).toBeNull();

    const { data: porCedula, error: errPorCedula } = await anon
      .schema("clientes")
      .from("clientes")
      .select("id")
      .eq("cedula", CEDULA_RIVAL)
      .maybeSingle();
    expect(errPorCedula).toBeNull();
    expect(porCedula).toBeNull();
  });
});
