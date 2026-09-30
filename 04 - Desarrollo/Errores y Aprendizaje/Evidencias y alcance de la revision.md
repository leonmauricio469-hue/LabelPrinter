# Evidencias y alcance de la revision

Fecha: 2026-09-29. Copia conservada: `LabelPrinter/label-printer-web`. Catálogo: **3.080 productos**. Este conjunto documenta la revisión; las propuestas de las fichas no se han aplicado al código.

## Qué respalda los hallazgos

Se leyó el código, se contrastó el catálogo y se hicieron comprobaciones aisladas de búsqueda, planificación de barcode, settings y concurrencia. El [informe técnico completo](<Anexos/Revision tecnica 2026-09-29.md>) conserva los detalles y los [resultados adicionales](Anexos/evidencias-revision.json) las mediciones en JSON. Las rutas antiguas del informe son antecedentes de la descarga: la fuente actual está en `LabelPrinter/label-printer-web`.

| Medición | Resultado | Alcance |
|---|---|---|
| Barcode duplicado | `7509546074627`, productos 2042 y 2048, precios distintos | Datos reales; la selección del primero se reproduce en software. |
| Códigos internos bloqueados | 285 | Protección de prefijos aplicada antes de coincidencia válida. |
| Etiqueta → búsqueda | 20 resultados no vuelven al producto: 19 sin coincidencia exacta y uno devuelve otro producto | Incluye causas relacionadas; no sumar a otros conteos. |
| Settings parcial | Faltan `printerName` y `businessName` tras leer | Comprobación aislada con copia de la implementación. |
| Estado concurrente | 6 consultas inician 6 procesos | Proceso simulado; demuestra ausencia de deduplicación en vuelo. |
| Lote de una etiqueta | 3.607 bytes; Base64 4.812 caracteres | Un producto de ejemplo; tamaño variable por contenido. |
| Lote de diez | 36.070 bytes; Base64 48.096 caracteres | Supera 32.767 caracteres antes de añadir el resto de argumentos. |
| Planes Code 128 | 561 planes no coinciden con modo B predeterminado emitido; 76 excederían 400 dots solo en barras | Código y cálculo contrastados con documentación; falta impresión física. |
| Nombres largos | 1.049 superan 30 caracteres; máximo 50 | Exposición aproximada, no 1.049 desbordes físicos demostrados. |
| Caracteres no ASCII | 105 nombres; 113 productos si se consideran otros campos | Riesgo de codificación confirmado en el envío; glifos por comprobar. |

Las comprobaciones anteriores de búsqueda (27 casos), barcode (32 casos y unicidad de códigos internos) y banderas de cola pasaron sobre artefactos compilados disponibles entonces. Eso no demuestra que todas las funciones sean correctas. Los artefactos se retiraron durante la limpieza; para repetir pruebas hay que compilar las fuentes y definir un comando, como indica M02.

## Qué sigue pendiente

No se instalaron dependencias ni se realizó un build completo de Next durante esta revisión. No se imprimieron etiquetas ni se probó Windows, TCP o el lector físico aquí. El tamaño de argumentos, la firma nativa y los comandos se contrastaron con documentación oficial; el comportamiento del equipo se registra por separado en M05.

Las notas antiguas contienen pruebas físicas realizadas previamente por el autor. Son antecedentes útiles, pero no equivalen a probar todos estos nuevos casos. Las fichas distinguen reproducción en software, revisión estática y confirmación física pendiente.

## Fuentes primarias

Las fichas correspondientes enlazan las referencias y explican su aplicación:

- [Zebra: Code 128 (^BC)](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-bc.html).
- [Zebra: bloques de texto (^FB)](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-fb.html).
- [Zebra: codificación (^CI)](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-ci.html).
- [Microsoft: CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw).
- [Microsoft: StartDocPrinter](https://learn.microsoft.com/en-us/windows/win32/printdocs/startdocprinter).
- [Microsoft: WritePrinter](https://learn.microsoft.com/en-us/windows/win32/printdocs/writeprinter).
- [Next.js: opciones de CLI](https://nextjs.org/docs/app/api-reference/cli/next).

Consulta [[Mapa de errores y aprendizaje]] para interpretar cada resultado y su propuesta de solución.
