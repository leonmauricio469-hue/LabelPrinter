import { z } from "zod";
import type { LabelZone } from "./label.template";

/**
 * Esquema de una zona de etiqueta, para validar lo que llega desde el navegador.
 *
 * Vive en su propio archivo y no dentro de `api/editor/preview/route.ts` porque lo usan dos
 * rutas: la que dibuja el preview y la que guarda el cambio. Si cada una tuviera el suyo,
 * el boton de aplicar validaria una cosa distinta de la que se ha visto en pantalla, que es
 * justo la clase de fallo que hace desconfiar de un editor de plantillas.
 *
 * `z.lazy` es necesario porque `LabelZone` es una union discriminada por `kind` y se citan a
 * si mismos en `zones` y `zonesWithoutBarcode`, que son arreglos.
 *
 * ESTE ESQUEMA TIENE QUE LLEGAR AL FINAL A TODOS LOS CAMPOS DE LA ZONA, Y NO ES COSA QUE SE
 * RECUERDE: `z.object` NO DA ERROR cuando le llega una clave que no ha declarado, la descarta
 * en silencio. El tipo `z.ZodType<LabelZone>` de abajo no lo avisa, porque comprobar que el
 * esquema ACEPTA todos los campos es distinto de comprobar que los CONSERVA.
 *
 * Lo que pasaba sin `uppercase` y sin `autoFit.maxBlockDots`: el navegador los mandaba bien, el
 * servidor los tiraba, y el preview se dibujaba con un layout que no era el de la plantilla. El
 * nombre salia pegado a las barras porque el tope de alto del bloque no llegaba, y el nombre
 * aparecia en el papel tal cual lo define la plantilla pero en la pantalla como si fuera otro.
 * Sin ningun error en ninguna parte: el 200 era correcto y el dibujo era el que el servidor
 * creia que le habian pedido.
 *
 * `check-zonas.ts` vigila que el esquema y la plantilla no se separen.
 */
export const zoneSchema: z.ZodType<LabelZone> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("text"),
      x: z.number().int().min(-2000).max(4000),
      y: z.number().int().min(-2000).max(4000),
      format: z.string().min(1).max(64),
      source: z.string().min(1).max(64),
      prefix: z.string().max(16).optional(),
      uppercase: z.boolean().optional(),
      maxWidthDots: z.number().int().min(0).max(8000).optional(),
      maxLines: z.number().int().min(1).max(12).optional(),
      justify: z.enum(["L", "C", "R"]).optional(),
      autoFit: z
        .object({
          maxHeight: z.number().int().min(4).max(400),
          minHeight: z.number().int().min(4).max(400),
          widthRatio: z.number().min(0.1).max(2),
          maxBlockDots: z.number().int().min(4).max(4000).optional(),
        })
        .optional(),
    }),
    z.object({
      kind: z.literal("barcode"),
      x: z.number().int().min(-2000).max(4000),
      y: z.number().int().min(-2000).max(4000),
      heightDots: z.number().int().min(10).max(2000),
      interpretationLine: z.boolean(),
      source: z.literal("barcode"),
      center: z.boolean().optional(),
      moduleWidth: z.number().int().min(1).max(10),
      hriHeightDots: z.number().int().min(0).max(200).optional(),
    }),
    z.object({
      kind: z.literal("graphic"),
      x: z.number().int().min(-2000).max(4000),
      y: z.number().int().min(-2000).max(4000),
      gf: z.string().min(1).max(2_000_000),
    }),
    z.object({
      kind: z.literal("shape"),
      x: z.number().int().min(-2000).max(4000),
      y: z.number().int().min(-2000).max(4000),
      widthDots: z.number().int().min(0).max(8000),
      heightDots: z.number().int().min(0).max(8000),
      thicknessDots: z.number().int().min(1).max(50),
      radiusDots: z.number().int().min(0).max(500).optional(),
    }),
  ]),
) as z.ZodType<LabelZone>;

/** Las zonas de una plantilla tal y como se guardan en el override. */
export const zonesSchema = z.array(zoneSchema).max(64);

/** Cuerpo de `POST /api/editor/apply`. */
export const applyBodySchema = z.object({
  templateId: z.string().min(1).max(64),
  zones: zonesSchema,
  zonesWithoutBarcode: zonesSchema.optional(),
});
