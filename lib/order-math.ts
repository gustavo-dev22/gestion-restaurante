export interface PricedItem {
  precio: number | string;
  cantidad: number;
}

/** Calcula el total de un pedido usando precios del servidor. */
export function calcularTotalPedido(items: PricedItem[]): number {
  return items.reduce(
    (total, item) => total + Number(item.precio) * Number(item.cantidad),
    0
  );
}

/**
 * `null`/`undefined` significa que el producto no controla stock.
 * En caso contrario, solo hay stock si alcanza para la cantidad pedida.
 */
export function stockSuficiente(
  stock: number | null | undefined,
  cantidad: number
): boolean {
  if (stock === null || stock === undefined) return true;
  return stock >= cantidad;
}
