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
- **E07 — enviado ≠ impreso.** TCP ya no responde éxito al conectar: espera a que la impresora reciba todo y cierre; una conexión cortada a mitad es fallo. La UI dice "enviada a la impresora" en vez de "impresa".
- **E10, E11, E21 — puente nativo del spooler.** `StartDocPrinter` declarado como la API real (3 parámetros, devuelve el ID del trabajo); la escritura se repite hasta enviar todos los bytes o cancela el trabajo; estado y envío usan el nombre exacto de la cola. El ID real del spooler llega a `/api/labels` y al historial (`spoolerJobId`).
- **E12, E17 — configuración.** `settings.json` se combina con los valores por defecto por sección y se valida al leer; un archivo inválido devuelve un error con el campo exacto en vez de usar defaults en silencio. Guardar escribe un temporal y lo reemplaza con `rename`, conserva `settings.json.bak` y encola los guardados.
- **E13, E14 — pantalla de configuración.** Un error al cargar se muestra con su motivo y un botón Reintentar en vez de "Cargando..." para siempre; la lista de colas termina siempre en "Otra cola..." y sin lista aparece el campo manual. Guardar se bloquea mientras guarda.
- **E15, E16 — estado de la impresora.** Con TCP ya no se muestra el estado de una cola USB: se informa que el estado físico no se puede consultar y se nombra `host:puerto`. Las consultas simultáneas comparten una sola lectura de PowerShell (también las forzadas) y el refresco posterior a imprimir ya no se pierde si llega durante otro sondeo.
- **E25 — aviso de dígito de control.** El aviso del catálogo sale del mismo cálculo que imprime: cubre también los UPC-A de 12 dígitos y dice "guarda X, se imprime Y" en vez de "ninguna etiqueta será legible". Los 6 productos afectados: 735, 1067, 1322, 1378, 1694, 1843.
- **E24 — búsqueda truncada.** La búsqueda devuelve `total` además de los 60 primeros, y la pantalla dice "Se muestran 60 de N… Escribe más para acotar" en vez de "60 productos coinciden".
- **E19, E23 — nombres en la etiqueta.** El nombre del producto tiene 2 líneas de fuente 12 (antes 1 de 14) y lo que no entra se corta con "..." en vez de superponerse; ningún nombre del catálogo real se corta. El nombre de empresa de `/settings` se imprime como texto cuando la etiqueta es demasiado chica para el logo. Los fixtures de 50 × 25 cambian en esas dos líneas, a propósito.
- **E20 — escucha local.** `npm run dev` y `npm run start` escuchan solo en `127.0.0.1` (`-H 127.0.0.1`); antes escuchaban en `0.0.0.0` y las rutas no tienen autenticación.
- **E22 — reintentos sin duplicados.** Un envío que pudo llegar (timeout o corte a mitad) se informa como incierto y pide revisar la impresora. Cada impresión lleva un `requestId`; el servidor no reenvía una solicitud ya enviada o incierta, y el cliente reutiliza el ID solo si se perdió la respuesta.
- **E26, E27 — plugins de Obsidian (parcial).** Los plugins cuyo `main.js` era una página HTML de Drive quedan desactivados. **Hallazgo nuevo E27:** `share-note/data.json` con un `apiKey` estaba en el repositorio público; deja de seguirse y se ignora. Falta rotar la clave en Share Note: ya estuvo publicada.

### Cambiado

- `ProductRepository`: `findByBarcode` → `findAllByBarcode`, `esPrefijoDeBarcode` → `findByBarcodePrefix`. `MatchKind` suma `ambiguous`.
- `planBarcode` también rechaza un EAN-13 que no cabe (antes no hacía falta: el ancho era fijo).

### Agregado

- `npm test` con `node:test`, sin dependencias nuevas.
- Fixtures del ZPL original de 50 × 25 en `label-printer-web/test/fixtures/`.
- Registro de correcciones en el vault.


### Mejorado

- **M01 — historial reconstruible.** Cada línea guarda el estado real del envío (enviado / fallido / incierto), el precio, el código emitido, los avisos, la medida de etiqueta y los tres identificadores (auditoría, solicitud, spooler). Las líneas anteriores se siguen leyendo. La pantalla de historial muestra estado, precio y código.
- **M02, M03, M04, M06 — proceso.** `npm run check` corre typecheck, 101 tests y las verificaciones del catálogo desde las fuentes, y falla con código distinto de cero. Historial de Git por ficha en la rama `fix/revision-2026-09-29`. README, Inicio, Estado del Proyecto y el mapa de fichas reflejan el estado real; el informe de Anexos queda como histórico. `.preview-build/` ignorado.
- **M05 — plan de prueba física.** 13 pruebas con 11 productos reales representativos para el puesto con Windows, la GK420t y el lector. Sin ejecutar: no hay hardware en este entorno.
