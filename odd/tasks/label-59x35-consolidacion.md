# Plantilla 59x35 mm — consolidacion y ajustes

## Objetivo
Que la plantilla de impresion reproduzca la estructura de la etiqueta de referencia de
59.00 x 35.00 mm (orientacion horizontal, sin escalado adicional del driver) sobre la
impresora **Zebra GX420** (203 dpi, ZPL crudo).

## Problema / por que
El repo tenia tres cabezas divergentes:

- `main` — plantilla vieja 50x25 mm, posiciones en dots, sin vista previa en pantalla.
- `origin/ui-redesign` — layout 59x35 mm + editor + preview que rasteriza el ZPL real.
  Historia **huerfana** (sin merge-base con `main`).
- `origin/fix/revision-2026-09-29` — endurecimiento, base `main@75ee9a8`.

La spec 59x35 mm ya estaba implementada casi entera en `ui-redesign`; `main` no la tenia.
Habia que unificar sin perder nada y recien despues ajustar.

## Alcance
- Unificar `main` + `ui-redesign` en una rama de trabajo, preservando los archivos
  solo-de-main (`promt`, `.obsidian/*`) y la edicion XPRO sin commitear.
- Cerrar los deltas reales entre la spec del usuario y el codigo.

## Hecho
- [x] **T1** — Merge `--allow-unrelated-histories -X theirs` de `ui-redesign` sobre rama
  `consolidacion` (basada en `main`). Resultado verificado: HEAD vs `ui-redesign` = solo los
  4 archivos solo-de-main. Commit `5334465`.
- [x] **T2** — XPRO reaplicado sobre `ui-redesign` (conviven `foldAscii` + filtro por prefijo
  `XPRO`). Commit `823eecf`.
- [x] **T3** — Precio **sin `$`**: sacado el `prefix: "$"` de las dos plantillas (con codigo y
  sin codigo). El precio sale pelado (`"5.00"`). Decision del usuario: sin config.
- [x] **T4** — Pie del precio (`PRICE_Y_MM = 24.5`) y del REF (`REFERENCE_Y_MM = 27`) alineado
  al fondo del codigo (29.5 mm). Antes el pie quedaba 0.75 mm por encima.
- [x] **T5** — Checks actualizados (`check-layout-v18` busca `"3.00"`; `check-zonas` largo de
  precio 8 -> 7). PNG de preview regenerado. Commit `9fa0199`.

## Evidencia
- `npm run typecheck` -> exit 0.
- `npm run check` -> **11/11 suites**, 271 comprobaciones, 0 incidencias.
- Render virtual (`preview/label-papicar-59x35.png`): barras `168..236`, precio `196..236`,
  REF `216..236`, HRI `244..256` (todo dentro de los 280 dots de alto).

## Pendiente / a decidir
- **REF** (decidido 9/10, **se queda**): imprime `"REF:"` (con dos puntos); la spec decia
  `Ejemplo: "REF"`. El usuario dijo "dejalo asi". No se toca.
- **GK420t -> GX420**: los comentarios y el vault dicen "GK420t" en ~20 lugares (codigo +
  docs + nombres de archivo del vault). La impresora real es **GX420**. Barrido aparte para no
  romper wikilinks de Obsidian a lo tonto.
- **Modulo del codigo de barras** = 2 dots (0.250 mm), 5% bajo el minimo ISO 15420 (0.264 mm).
  **No se toca**: fue decision del usuario el 8/10 tras una prueba fisica ("barras demasiado
  anchas" a modulo 3). Queda documentado como riesgo de escaneo.
- **Nombre "gruesa/bold"**: el `^A0N` de ZPL no tiene negrita; se lograria sobre-imprimiendo o
  con otra fuente. No es un parametro del formato actual.

## Estrategia de entrega
Rama de trabajo = `consolidacion`. `main` queda intacto en `5906290`. PR hacia `main` cuando el
usuario lo decida. Sin push.

## Proximo paso
Cerrar las decisiones de "Pendiente" y, si corresponde, el barrido GK420 -> GX420.
