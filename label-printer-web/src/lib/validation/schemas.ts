import { z } from "zod";

/**
 * Producto del catalogo local (`data/catalog.json`).
 *
 * Se valida al LEER el archivo, no solo al escribirlo: el catalogo se edita a mano y un
 * typo (un precio en cadena, un barcode vacio) tiene que salir a la luz antes de que
 * llegue a una etiqueta.
 */
export const productSchema = z.object({
  code: z.string().min(1, "code vacio"),
  name: z.string().min(1, "name vacio"),
  price: z.number().nonnegative("price no puede ser negativo"),
  reference: z.string().min(1, "reference vacia"),
  barcode: z.string().min(1, "barcode vacio").max(48),
});

export type ProductInput = z.infer<typeof productSchema>;

/**
 * `POST /api/labels`: pide imprimir por codigo de producto, no los datos completos.
 *
 * El servidor busca el producto en el catalogo y arma el ZPL. Asi el cliente nunca puede
 * imprimir un precio que no sea el del catalogo.
 */
export const printRequestSchema = z.object({
  productCode: z.string().min(1, "falta el codigo del producto"),
  qty: z.coerce
    .number()
    .int("la cantidad debe ser un numero entero")
    .min(1, "la cantidad minima es 1")
    .max(999, "la cantidad maxima es 999")
    .default(1),
  mode: z.enum(["normal", "fast"]).default("normal"),
});

export type PrintRequestInput = z.infer<typeof printRequestSchema>;

export const updateSettingsSchema = z.object({
  printer: z.object({
    transport: z.enum(["tcp", "usb"]),
    host: z.string().min(1),
    port: z.number().int().positive().max(65535),
    printerName: z.string().min(1),
  }),
  label: z.object({
    // 104 mm es el ancho maximo de impresion de la GK420t. Los minimos son donde la
    // plantilla escalada (`buildLabelTemplate`) todavia deja nombre, precio y referencia
    // legibles.
    widthMm: z.number().min(30).max(104),
    heightMm: z.number().min(20).max(100),
    businessName: z.string().min(1),
  }),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
