// Casos de uso de administración del producto de crédito: crear el producto
// y actualizar sus políticas de decisión (SRP: una acción de negocio cada uno).

import type { Resultado } from "../../../kernel/result";
import {
  actualizarReglas,
  crearProducto,
  type DatosProducto,
  type ProductoCredito,
  type ReglasDecision,
} from "../domain/credit-product";
import type { RepositorioProductos } from "../domain/repositories";

export class CrearProductoCredito {
  constructor(private readonly productos: RepositorioProductos) {}

  async ejecutar(datos: DatosProducto): Promise<Resultado<ProductoCredito, string[]>> {
    const creacion = crearProducto(datos);
    if (!creacion.ok) return creacion;
    const guardado = await this.productos.guardar(creacion.valor);
    return { ok: true, valor: guardado };
  }
}

export class ActualizarReglasDecision {
  constructor(private readonly productos: RepositorioProductos) {}

  async ejecutar(
    productoId: string,
    reglasNuevas: ReglasDecision,
  ): Promise<Resultado<ProductoCredito, string[]>> {
    const producto = await this.productos.buscarPorId(productoId);
    if (!producto) {
      return { ok: false, error: [`producto no encontrado: ${productoId}`] };
    }
    const actualizacion = actualizarReglas(producto, reglasNuevas);
    if (!actualizacion.ok) return actualizacion;
    const guardado = await this.productos.actualizarReglas(actualizacion.valor);
    return { ok: true, valor: guardado };
  }
}
