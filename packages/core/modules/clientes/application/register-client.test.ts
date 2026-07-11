import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../../kernel/event-bus";
import { exito, fallo, type Resultado } from "../../../kernel/result";
import type { DatosCiudadano } from "../domain/citizen-data";
import type { Cliente } from "../domain/client";
import type { RepositorioClientes } from "../domain/client-repository";
import type { FuenteIdentidad } from "../domain/identity-source";
import { RegistrarCliente } from "./register-client";

// Fakes en memoria: sustituyen a Supabase y al escáner sin cambiar el caso de uso (LSP)

class RepositorioEnMemoria implements RepositorioClientes {
  private clientes: Cliente[] = [];

  async guardar(cliente: Cliente): Promise<Cliente> {
    const guardado = { ...cliente, id: `cli-${this.clientes.length + 1}` };
    this.clientes.push(guardado);
    return guardado;
  }

  async buscarPorCedula(cedula: string): Promise<Cliente | null> {
    return this.clientes.find((c) => c.cedula === cedula) ?? null;
  }
}

class FuenteFija implements FuenteIdentidad {
  readonly nombre = "escaner" as const;
  constructor(private respuesta: Resultado<DatosCiudadano, string>) {}
  async capturar(): Promise<Resultado<DatosCiudadano, string>> {
    return this.respuesta;
  }
}

const DATOS_VALIDOS: DatosCiudadano = {
  cedula: "1012345678",
  nombres: "Carlos",
  apellidos: "Rodríguez",
  fechaNacimiento: "1990-05-15",
};

function armarCasoDeUso(fuente: FuenteIdentidad) {
  const repositorio = new RepositorioEnMemoria();
  const bus = new EventBus();
  const casoDeUso = new RegistrarCliente([fuente], repositorio, bus);
  return { casoDeUso, repositorio, bus };
}

describe("RegistrarCliente", () => {
  it("registra un cliente nuevo y emite clientes.cliente.registrado", async () => {
    const { casoDeUso, bus } = armarCasoDeUso(new FuenteFija(exito(DATOS_VALIDOS)));
    const oyente = vi.fn();
    bus.on("clientes.cliente.registrado", oyente);

    const resultado = await casoDeUso.ejecutar({
      fuente: "escaner",
      entradaCruda: { codigo: "1012345678" },
      tiendaId: "tienda-1",
    });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.valor.id).toBeDefined();
      expect(resultado.valor.cedula).toBe("1012345678");
      expect(resultado.valor.fuenteIdentidad).toBe("escaner");
    }
    expect(oyente).toHaveBeenCalledOnce();
  });

  it("es idempotente por cédula: reintentar devuelve el existente sin duplicar ni re-emitir", async () => {
    const { casoDeUso, bus } = armarCasoDeUso(new FuenteFija(exito(DATOS_VALIDOS)));
    const oyente = vi.fn();
    bus.on("clientes.cliente.registrado", oyente);
    const comando = {
      fuente: "escaner" as const,
      entradaCruda: { codigo: "1012345678" },
      tiendaId: "tienda-1",
    };

    const primero = await casoDeUso.ejecutar(comando);
    const segundo = await casoDeUso.ejecutar(comando);

    expect(segundo.ok).toBe(true);
    if (primero.ok && segundo.ok) {
      expect(segundo.valor.id).toBe(primero.valor.id);
    }
    expect(oyente).toHaveBeenCalledOnce();
  });

  it("devuelve el error de la fuente cuando la captura falla", async () => {
    const { casoDeUso } = armarCasoDeUso(
      new FuenteFija(fallo("el escáner no pudo leer la cédula")),
    );

    const resultado = await casoDeUso.ejecutar({
      fuente: "escaner",
      entradaCruda: { codigo: "xxx" },
      tiendaId: "tienda-1",
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain("el escáner no pudo leer la cédula");
    }
  });

  it("rechaza una fuente de identidad desconocida", async () => {
    const { casoDeUso } = armarCasoDeUso(new FuenteFija(exito(DATOS_VALIDOS)));

    const resultado = await casoDeUso.ejecutar({
      fuente: "entrada_manual",
      entradaCruda: {},
      tiendaId: "tienda-1",
    });

    expect(resultado.ok).toBe(false);
  });
});
