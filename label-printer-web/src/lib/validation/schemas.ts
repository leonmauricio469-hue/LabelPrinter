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
 * Historial: `usb.transport.ts` mandaba el ZPL entero como un argumento de linea de
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
 * dejar registro en el historial.
 *
 * Desde el transporte por archivo temporal (`sendZplUsb()` escribe el ZPL y `argv` lleva
 * solo `-FilePath` con la ruta corta, ~200 caracteres sin importar la cantidad), el techo
 * de `CreateProcessW` ya no manda: 50 etiquetas son ~181 KB en archivo y el mismo `argv`
 * corto. El tope actual (50) es operativo, no del mecanismo: evita tirar un rollo con un
 * tecleo, y `quantity-stepper.tsx` lo hereda sin tocarlo.
 */
export const MAX_QTY_POR_TRABAJO = 50;

export const printRequestSchema = z.object({
  productCode: z.string().min(1, "falta el codigo del producto"),
  qty: z.coerce
    .number()
    .int("la cantidad debe ser un numero entero")
    .min(1, "la cantidad minima es 1")
    .max(
      MAX_QTY_POR_TRABAJO,
      `la cantidad maxima por trabajo es ${MAX_QTY_POR_TRABAJO}: por encima se evita tirar papel con un tecleo`,
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
    /**
     * El ancho del medio va con rango, no solo positivo.
     *
     * Por un lado hay un minimo: a 4 dots la zona quieta del EAN-13 no cabe ni de lejos y
     * `planBarcode()` lo dira, pero mejor que el numero no llegue ahi.
     *
     * Y por otro hay un maximo de 170 mm, que es el ancho maximo de medio de la GK420t. Con
     * 59 mm de diseno no aporta nada, y un numero enorme aqui es casi siempre un error de
     * tecleo que nadie va a ver hasta que salga una tira de papel en blanco.
     */
    mediaWidthMm: z
      .number()
      .min(20, "un medio de menos de 20 mm no puede llevar esta etiqueta")
      .max(170, "la GK420t no acepta medios de mas de 170 mm de ancho"),
  }),
  label: z.object({
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
    businessName: z.string().min(1),
    templateId: z.string().min(1).default(DEFAULT_TEMPLATE_ID),
  }),
  /**
   * Campos F11. `oscuridad` es "" (vacia = actual) o un entero 0-30 para `~SD`.
   * `retardoEscanerMs` con suelo de 100: por debajo, un escaneo USB normal
   * (que tarda decenas de ms entre caracteres) se partiria en dos.
   */
  oscuridad: z
    .string()
    .regex(/^(|30|[12][0-9]|[0-9])$/, "la oscuridad es vacia o un entero de 0 a 30")
    .default(""),
  sonidoOk: z.boolean().default(true),
  sonidoError: z.boolean().default(true),
  ventanaDuplicadosMs: z.number().int().min(0).max(60000).default(0),
  retardoEscanerMs: z.number().int().min(100).max(5000).default(500),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
