import { z } from "zod";
// Import RELATIVO a proposito: los scripts de `scripts/` compilan con `tsconfig.preview.json`,
// que no tiene los alias `@/*` de la app. Ver AGENTS.md.
import { DEFAULT_TEMPLATE_ID } from "../labels/label.template";

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

/**
 * Tope de etiquetas por trabajo.
 *
 * No es arbitrario: `usb.transport.ts` manda el ZPL entero como un argumento de linea de
 * comandos en base64, y Windows corta `CreateProcessW` en 32767 caracteres. Medido con el
 * nombre mas largo del catalogo real (50 caracteres), una etiqueta son 3629 bytes de ZPL,
 * que son 4840 en base64, mas unos 200 del resto del argumento:
 *
 *     qty 5   24196 + 200 = 24396   ok
 *     qty 6   29032 + 200 = 29232   ok, el ultimo
 *     qty 7   33872 + 200 = 34072   ENAMETOOLONG
 *
 * Con el tope en 999, `qty: 7` reventaba `spawn` de forma sincrona dentro del `new Promise`,
 * nadie la capturaba, y `POST /api/labels` devolvia un 500 generico sin imprimir nada y sin
 * dejar registro en el historial. No es un limite de negocio: es el techo del mecanismo de
 * envio por linea de comandos.
 *
 * Si esto sube, hay que cambiar como se pasa el ZPL a `send-raw.ps1` (archivo temporal o
 * stdin), no solo este numero.
 */
export const MAX_QTY_POR_TRABAJO = 6;

export const printRequestSchema = z.object({
  productCode: z.string().min(1, "falta el codigo del producto"),
  qty: z.coerce
    .number()
    .int("la cantidad debe ser un numero entero")
    .min(1, "la cantidad minima es 1")
    .max(
      MAX_QTY_POR_TRABAJO,
      `la cantidad maxima por trabajo es ${MAX_QTY_POR_TRABAJO}: por encima, el ZPL no cabe en la linea de comandos de Windows y la impresion falla sin dejar registro`,
    )
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
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    businessName: z.string().min(1),
    templateId: z.string().min(1).default(DEFAULT_TEMPLATE_ID),
  }),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
