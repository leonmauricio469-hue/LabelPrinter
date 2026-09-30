# Changelog

Cambios de LabelPrinter desde la revisión técnica del 2026-09-29. Cada entrada enlaza la ficha del vault (`04 - Desarrollo/Errores y Aprendizaje/`) donde está el problema, y su nota de corrección con el antes, el cambio y el después.

Verificación: `npm test` y `npm run typecheck` en `label-printer-web/`. Nada de lo que sigue se probó todavía con la impresora ni el lector físicos; cada entrada dice qué falta.

## [Sin publicar] — rama `fix/revision-2026-09-29`

### Corregido

- **E01 — barcode duplicado.** `7509546074627` (productos 2042 y 2048) ya no devuelve el primero: la búsqueda responde `ambiguous` y pide elegir; `/fast` no imprime y `/api/labels` no toma el primero.
- **E02 — prefijos bloqueaban identificadores completos.** Los 285 códigos internos como `1` o `438`, y barcodes completos como `4796019560234`, se ofrecen primero en vez de descartarse.
- **E03 — la etiqueta no volvía a su producto.** La búsqueda reconoce el código tal como se imprime (`barcodeImpreso`). En el catálogo real, 3.061 de 3.075 etiquetas vuelven exactas y 14 ambiguas; ninguna se pierde.
- **E04 — `/fast` perdía escaneos.** Cola FIFO (`scan.queue.ts`) en lugar de un único pendiente.
- **E05 — medidas ignoradas.** La plantilla sale de ancho y alto de `/settings` (`buildLabelTemplate`); 50 × 25 mm produce byte a byte la etiqueta original. Límites 30–104 × 20–100 mm. Provisional hasta fijar un estándar.
- **E06 — texto que se volvía comando ZPL.** Todos los campos usan `^FH\` y escapan `^`, `~` y `\`.
- **E08 — Code 128 medido ≠ impreso.** Los subconjuntos viajan explícitos en `^FD`; `^BC` declara modo `N`.
- **E09 — lotes USB grandes fallaban.** El lote va por stdin a `send-raw.ps1`; la línea de comandos tiene tamaño fijo.
- **E18 — codificación USB/TCP distinta.** `^CI28` en cada etiqueta y UTF-8 en ambos transportes.

### Cambiado

- `ProductRepository`: `findByBarcode` → `findAllByBarcode`, `esPrefijoDeBarcode` → `findByBarcodePrefix`. `MatchKind` suma `ambiguous`.
- `planBarcode` también rechaza un EAN-13 que no cabe (antes no hacía falta: el ancho era fijo).

### Agregado

- `npm test` con `node:test`, sin dependencias nuevas.
- Fixtures del ZPL original de 50 × 25 en `label-printer-web/test/fixtures/`.
- Registro de correcciones en el vault.
