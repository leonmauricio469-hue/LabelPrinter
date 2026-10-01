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
      maxWidthDots: z.number().int().min(0).max(8000).optional(),
      maxLines: z.number().int().min(1).max(12).optional(),
      justify: z.enum(["L", "C", "R"]).optional(),
      autoFit: z
        .object({
          maxHeight: z.number().int().min(4).max(400),
          minHeight: z.number().int().min(4).max(400),
          widthRatio: z.number().min(0.1).max(2),
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
