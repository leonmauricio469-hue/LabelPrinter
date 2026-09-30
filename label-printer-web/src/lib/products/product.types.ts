/**
 * Contrato de dominio de un producto. Sin dependencias de servidor: este archivo si
 * puede importarse desde componentes de cliente para tipar la UI.
 */
export interface Product {
  /** codigo interno del producto, ej. "P-0001" */
  code: string;
  /** descripcion comercial tal como va a la etiqueta */
  name: string;
  /** precio de venta en dolares */
  price: number;
  /** referencia interna que se imprime junto al precio */
  reference: string;
  /** codigo de barras que escanea el operador (EAN-13 / EAN-8) */
  barcode: string;
}
