# Revisión de LabelPrinter

**Limpieza posterior:** la versión avanzada se trasladó a `LabelPrinter/label-printer-web/`. Se eliminaron la copia antigua, el manifiesto de descarga, análisis temporales, compilaciones, logs y el backup del catálogo de prueba. Las rutas anteriores citadas en este informe documentan la ubicación durante la revisión. El código y los datos actuales se verificaron por SHA-256 tras el traslado.

Fecha: 2026-09-29. Descarga y revisión de las dos carpetas compartidas.

**Revisión ampliada:** se añadieron los hallazgos 8–17 y mejoras adicionales. Los problemas de mayor impacto nuevos son el desajuste de Code 128 y el límite de argumentos del transporte USB. Las evidencias cuantitativas están en `REVISION-LabelPrinter-evidencias-extra.json`.

## Qué copia usar

El segundo enlace (`1Y8xOvMoOH_tlDTIrlfdfG1S1F0YNNexA`) es la carpeta `LabelPrinter` dentro del primer enlace. No son dos proyectos iguales:

| Copia local | Estado observado |
|---|---|
| `LabelPrinter-drive/label-printer-web` | Prototipo: etiqueta estática, configuración y transporte TCP. Catálogo vacío. |
| `LabelPrinter-drive/LabelPrinter/label-printer-web` | Versión avanzada: catálogo de 3.080 productos, búsqueda, escaneo, modo rápido, USB en Windows, historial y estado de cola. |

La comparación de los archivos de las apps, excluyendo `.next`, `node_modules` y `.preview-build`, encuentra 27 archivos en la copia antigua y 87 en la avanzada: 12 idénticos, 15 diferentes y 60 adicionales en la avanzada. Conviene continuar con la carpeta interna. La documentación externa describe un estado anterior; incluso algunas notas internas están desactualizadas respecto al catálogo real.

## Descarga

Archivos guardados en `LabelPrinter-drive/`, conservando la estructura. El manifiesto está en `drive-download-manifest.json` y registra archivos, tamaños, IDs y omisiones.

Se excluyeron las cuatro carpetas `.next` y `node_modules` de ambas apps. Una parte de `.next` externa se descargó antes de identificar estas cachés y permanece localmente. Por tanto, esta es una descarga del proyecto y documentación, no una réplica completa de dependencias y compilaciones.

Tres archivos de plugins de Obsidian en la carpeta interna contienen páginas HTML de advertencia de Drive en lugar de código: los dos `main.js` y `obsidian_askpass.sh`. Se confirmó el contenido mediante el endpoint de descarga y se guardaron tal como están en origen. No son scripts válidos y sus advertencias constan en el manifiesto. El código de la aplicación y sus scripts PowerShell sí se descargaron.

## Hallazgos prioritarios en la versión avanzada

### 1. Un barcode corresponde a dos productos con precios distintos

`7509546074627` aparece en:

- Producto `2042`: PALMOLIVE JABON HIDRATACION RADIANTE, $2,55.
- Producto `2048`: PALMOLIVE SENSACION HUMECTANTE, $3,60.

`findByBarcode()` usa `.find()` y devuelve el primer producto (`src/lib/products/product.catalog.repository.ts:115`). La búsqueda lo marca como exacto; el modo rápido imprime sin pedir selección. Escanear la etiqueta del 2048 devuelve el 2042. Hay que corregir el dato o representar explícitamente la ambigüedad y exigir selección.

### 2. La protección contra escaneos parciales bloquea códigos completos

`resolveQuery()` descarta cualquier candidato que sea prefijo de otro barcode antes de probar su coincidencia completa (`src/lib/products/product.lookup.ts:120`). Eso también bloquea códigos internos legítimos: 285 de los 3.080 no vuelven a resolver como exactos, incluidos `1`, `2`, `3` y `438`. Buscar por nombre y elegir sigue permitiendo imprimir esos productos; lo roto es su búsqueda exacta por código.

Además, ciertos barcodes completos son prefijos de otros, y se rechazan aun siendo válidos. Ejemplos observados: `202616` (producto 350) y `4796019560234` (247). Conviene distinguir la búsqueda manual por código del escaneo y tratar las ambigüedades sin descartar silenciosamente un identificador completo.

### 3. Veinte productos no completan el ciclo imprimir → escanear → mismo producto

Se generó el plan de barcode de los 3.080 productos y se consultó el identificador que realmente se imprimiría. Entre los productos con barcode imprimible, 20 no vuelven al mismo producto: 19 no producen coincidencia exacta y el 2048 devuelve el 2042.

Seis casos son dígitos de control corregidos al imprimir, mientras el catálogo conserva el original: productos 735, 1067, 1322, 1378, 1694 y 1843. Por ejemplo, el 1067 guarda `0400000570608`, imprime `0400000570600`, y al consultar el código impreso responde `none`.

Hay que resolver de forma consistente el código impreso y el código de origen, validando colisiones. Estas comprobaciones son de software; no sustituyen la lectura de una etiqueta física.

### 4. El modo rápido puede perder escaneos

`src/app/fast/page.tsx:36` asigna cada escaneo recibido durante una impresión a un único `pendingRef`. Con A imprimiendo, B pendiente y luego C, C sobrescribe B sin aviso. La nota técnica documenta una latencia USB aproximada de 2,4 segundos, pero no se midió en este entorno. Una cola FIFO o un rechazo visible evita esta pérdida silenciosa.

### 5. Las medidas guardadas no cambian la etiqueta

`src/app/api/labels/route.ts:71` y `:105` usan `DEFAULT_TEMPLATE` para geometría y generación. Los valores `settings.label.widthMm` y `heightMm` no se aplican, aunque la configuración permite guardarlos. La plantilla debe derivarse de esas medidas y volver a validar el espacio disponible.

### 6. El texto se inserta sin escapar ZPL

`src/lib/labels/zpl.builder.ts:127` interpola texto directamente en `^FD`. Una ejecución del generador con nombre `CAFE^FS^XZ` produjo `^FDCAFE^FS^XZ^FS`: los datos pueden cerrar campos y etiquetas. Hay que escapar caracteres de control ZPL y fijar una codificación compatible para los textos.

### 7. Éxito de envío no confirma impresión física

`tcp.transport.ts:13` devuelve éxito inmediatamente después de `socket.write()`, antes de confirmar el envío completo. USB informa aceptación por el spooler, pero la interfaz dice que la etiqueta está impresa. La consulta de estado de cola es útil, pero las notas dejan pendiente comprobar físicamente cómo el driver informa falta de papel, cinta o desconexión. Conviene mostrar “enviado a la cola” hasta disponer de confirmación suficiente.

## Validación realizada

- Pruebas existentes de búsqueda: 27/27 pasan.
- Pruebas existentes del plan de barcode: 32/32 pasan, además de comprobar códigos internos únicos en el catálogo.
- Pruebas existentes del mapa de estados de cola: pasan.
- Los scripts compilados descargados se ejecutaron directamente con Node; también se comprobaron las fuentes TypeScript en una copia temporal con extensiones de import adaptadas para Node, sin editar los originales.
- Comprobaciones adicionales sobre los 3.080 productos detectaron los 285 códigos internos sin coincidencia exacta y los 20 fallos del ciclo de retorno descritos arriba.
- Confirmado: 2.250 planes EAN-13, 561 Code 128 y 269 etiquetas sin barcode. De estas últimas, 29 pertenecen a RETAIL y requieren una decisión operativa.

No se instalaron dependencias, no se ejecutó el build de Next.js y no se probó hardware. Este entorno es Linux; la ruta USB real depende de Windows y PowerShell. Las pruebas físicas anteriores son afirmaciones de la documentación compartida, no verificaciones realizadas aquí.

## Orden recomendado

Primero corregir resolución de productos, barcode duplicado y ciclo de retorno. Después asegurar la cola del modo rápido, aplicar medidas y escapar ZPL. Por último validar el estado físico de la impresora en el puesto y continuar con gestión del catálogo y arranque como servicio. El editor de plantillas puede seguir para una fase posterior.


## Revisión ampliada: nuevos hallazgos

Prioridades: P1 = corregir antes de confiar en ese flujo de impresión; P2 = fallo operativo o de robustez; P3 = mejora de trazabilidad o experiencia. Los números calculados describen esta copia del catálogo y plantilla, no una medición de hardware.

### 8. P1 — Code 128 se calcula como comprimido, pero se envía en el modo predeterminado

Ubicación: `src/lib/labels/barcode-plan.ts:198`, `src/lib/labels/code128.ts:97` y `src/lib/labels/zpl.builder.ts:98`.

El cálculo usa subconjunto C para secuencias numéricas. Sin embargo, el ZPL emitido es `^BCN,72,Y,N,N`: omite el sexto parámetro `m`, no incluye un carácter de inicio en `^FD` y no activa `A`. La documentación de Zebra especifica modo predeterminado N y subconjunto B cuando no se indica inicio. Por tanto, el centro y los márgenes se calculan para un símbolo distinto del solicitado a la impresora.

Medido sobre el catálogo: los 561 planes Code 128 usan un ancho menor que el correspondiente al subconjunto B. En 76 casos, el símbolo B por sí solo supera los 400 dots de papel, antes de agregar márgenes. Ejemplo: producto 246, dato `47960195602341`: el programa calcula 112 módulos (336 dots), mientras B requiere 189 (567 dots). Producto 239, `0000180`: 90 módulos calculados frente a 112 en B; aunque las barras entren en el ancho total, el centro elegido puede dejar insuficiente margen derecho.

Solución: generar explícitamente los cambios de subconjunto y usar esos mismos símbolos para medir, o seleccionar modo A y ajustar el algoritmo al comportamiento real de ese modo. No basta con añadir A y conservar cualquier aproximación para datos mixtos. Verificar las etiquetas con el lector del puesto.

Fuente: [Zebra: comando ^BC, modos y subconjuntos](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-bc.html).

### 9. P1 — Tiradas válidas exceden el límite de argumentos de Windows

Ubicación: `src/lib/printing/usb.transport.ts:37` y `:97`; `buildZplBatch()` repite también el gráfico del logo en cada copia.

Todo el lote va en un argumento `-Base64` al arrancar PowerShell. Para el producto 232, una etiqueta genera 3.607 bytes ZPL y 4.812 caracteres base64. Diez etiquetas producen 48.096 caracteres base64, sin contar el ejecutable y los otros argumentos. Windows limita la línea completa a 32.767 caracteres. La API admite hasta 999 etiquetas: el fallo aparece mucho antes, aproximadamente a partir de siete para este producto.

Solución: pasar el contenido por stdin o por un archivo temporal con limpieza garantizada, en lugar de argumentos. Considerar `^PQ` para copias iguales y reutilizar el logo, con una prueba física del conteo. Esta comprobación midió contenido generado; no se intentó imprimir ni arrancar PowerShell en Windows.

Fuente: [Microsoft: CreateProcessW y límite de longitud](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw).

### 10. P2 — Firma P/Invoke incorrecta y ausencia del ID real del spooler

Ubicación: `scripts/send-raw.ps1:67` y `:125`.

La función está declarada como `bool StartDocPrinter(..., out IntPtr jobId)` con cuatro parámetros. La API nativa recibe tres parámetros y devuelve el identificador del trabajo como DWORD. El cuarto argumento no tiene un parámetro nativo que lo rellene.

En Windows de 64 bits la llamada puede parecer funcionar porque el argumento adicional se ignora y un DWORD no cero se interpreta como verdadero; eso no hace correcta la declaración ni obtiene el identificador. En otras convenciones de llamada la discrepancia es más peligrosa. No se afirma que la impresión de 64 bits falle siempre.

Solución: declarar retorno `uint` y tres parámetros, guardar el retorno y comprobar cero como error. Llevar ese ID real hasta la API y el historial: el `jobId` actual es un UUID de auditoría, no el identificador de la cola.

Fuente: [Microsoft: StartDocPrinter](https://learn.microsoft.com/en-us/windows/win32/printdocs/startdocprinter).

### 11. P2 — Acepta una escritura incompleta como envío exitoso

Ubicación: `scripts/send-raw.ps1:131`–`:144`.

Se comprueba el booleano de `WritePrinter`, pero nunca que `$written` sea igual a `$bytes.Length`. El helper puede emitir `ok: true` sin exigir que el trabajo completo haya sido entregado. La API oficial devuelve por separado la cantidad de bytes escritos.

Solución: comprobar el conteo y completar el envío según el contrato de la API, o fallar y cancelar el trabajo con un mensaje preciso. Este hallazgo es del código y contrato nativo; no se reprodujo una escritura parcial en hardware.

Fuente: [Microsoft: WritePrinter](https://learn.microsoft.com/en-us/windows/win32/printdocs/writeprinter).

### 12. P2 — Configuración en disco sin validar y mezcla superficial de valores

Ubicación: `src/lib/settings/settings.store.ts:23`.

`JSON.parse()` se convierte por aserción a `AppSettings`. El spread solo combina el nivel superior: `{ printer: { transport: "usb" }, label: { widthMm: 50 } }` elimina los valores predeterminados de las propiedades internas. Ejecutando la función original en una copia temporal, se confirmó que devuelve `printerName` y `businessName` ausentes sin rechazar la configuración.

Una edición manual o un archivo antiguo puede romper `/settings` y las rutas de impresión. Solución: validar el JSON al leer, combinar defaults por cada sección antes de validarlos y presentar un diagnóstico que permita recuperar la configuración. No confundir una configuración incompleta con la inexistencia del archivo.

### 13. P2 — El error inicial de configuración queda oculto tras “Cargando”

Ubicación: `src/app/settings/page.tsx:29`–`:36` y `:114`.

Si `/api/settings` responde 500 o falla la red, se guarda un estado de error, pero `settings` continúa en null. El retorno temprano muestra únicamente “Cargando configuracion...” y nunca llega al componente que muestra el error. El operador no tiene un mensaje útil ni botón de reintento.

Solución: separar los estados de carga, error y formulario; renderizar el error inicial y permitir volver a consultar. También falta validar el objeto recibido antes de acceder a `settings.printer`.

### 14. P2 — La alternativa para escribir la cola de impresora no es alcanzable normalmente

Ubicación: `src/app/settings/page.tsx:119`–`:122` y `:156`–`:177`.

Si falla `/api/printers`, la página dice que se puede escribir el nombre a mano. Sin embargo, `queueOptions` siempre agrega el nombre guardado cuando no está en la lista. Incluso con `printers = []`, genera una opción y se renderiza el select, no el input. El usuario queda atrapado en la cola existente precisamente cuando necesita corregirla.

Solución: ofrecer una opción explícita “Otra cola” con entrada manual, o mostrar el input si la enumeración falla. Los detalles técnicos de PowerShell deben quedar en ayuda de diagnóstico, no ser requisito para guardar un nombre.

### 15. P2 — El estado consultado no sigue el transporte seleccionado

Ubicación: `src/app/api/printer/status/route.ts:29` y `:39`.

La ruta siempre consulta `settings.printer.printerName` en Windows, aun cuando se seleccionó transporte TCP. Puede mostrar una cola USB lista o bloqueada mientras las etiquetas se envían a otra impresora de red. En Linux ni siquiera existe PowerShell, aunque el envío TCP es viable.

Solución: elegir el proveedor de estado según `transport`. Si TCP no tiene consulta implementada, indicar “estado físico desconocido” y mostrar host/puerto de destino; no reutilizar el estado de la cola USB. La prueba de conexión TCP también necesita un mensaje específico: actualmente la página habla siempre de una cola.

### 16. P2 — La caché de estado no agrupa consultas simultáneas

Ubicación: `src/lib/printing/queue.status.ts:111`–`:136`.

La caché solo existe cuando terminó una consulta. Si llegan varias durante la primera lectura, todas ejecutan `runStatus()`. Una comprobación del código copiado, sustituyendo únicamente `spawn` por un proceso simulado, confirmó seis procesos para seis solicitudes concurrentes a la misma cola. No se invocó PowerShell real.

Además, el banner usa `force=1` al montar y después de imprimir; esos sondeos se saltan la caché. Conviene guardar una promesa en curso por cola para compartirla, incluso entre solicitudes forzadas concurrentes. En el cliente, `inFlight` evita solapar sondeos, pero un refresco posterior a impresión que llega durante otro sondeo se descarta: sería mejor recordar un refresco pendiente.

### 17. P2 — Guardar configuración puede truncar el archivo que otros leen

Ubicación: `src/lib/settings/settings.store.ts:28` y `src/app/settings/page.tsx:214`.

Se escribe directamente con `fs.writeFile` sobre el archivo de producción, sin reemplazo atómico. La página tampoco bloquea el botón Guardar mientras guarda. Un lector simultáneo puede observar el archivo truncado o parcial; un cierre durante la escritura puede dejarlo corrupto. Este es un riesgo concreto de la implementación, sin reproducción de un corte de proceso en esta revisión.

Solución: serializar guardados, escribir y validar un archivo temporal en el mismo directorio, reemplazarlo y conservar una copia recuperable. Deshabilitar acciones incompatibles mientras se guarda.

## Mejoras adicionales de producto y trazabilidad

- **Nombre de empresa:** se guarda `businessName`, pero ninguna zona de la plantilla actual lo imprime; siempre aparece el logo PA PICAR. Ocultar ese ajuste hasta que funcione, o definir claramente si se cambia texto, logo o ambos.
- **Historial verificable:** conservar precio usado, barcode realmente emitido, avisos, plantilla/version y el ID real del spooler. Hoy solo se guardan código, nombre, cantidad y un resultado booleano, así que no se puede reconstruir qué precio o código se mandó imprimir.
- **Reintentos sin duplicados:** un request aceptado por la cola cuyo response se pierde se presenta como fallo de red. El siguiente intento puede imprimir otra vez. Añadir un ID de solicitud y registrar el estado del trabajo antes de permitir reintentos automáticos; evitar prometer impresión “exactamente una vez” sin confirmación del dispositivo.
- **Búsqueda truncada:** se cortan las coincidencias a 60 sin devolver total ni indicador de truncamiento. La UI presenta “60 productos coinciden” aunque sean más. Mostrar que faltan resultados y pedir refinar la consulta, o añadir paginación.
- **Pruebas útiles:** incluir todo el ciclo plan de impresión → identificador emitido → búsqueda → mismo producto, barcodes duplicados, tiradas grandes por USB y tres escaneos durante una impresión. Son los huecos que las pruebas existentes no detectan.

## Evidencias y límites de esta ampliación

Las medidas de lotes, diferencias de Code 128 y comprobaciones de configuración/concurrencia están en `REVISION-LabelPrinter-evidencias-extra.json`. Se usaron el código fuente y el catálogo descargados; las adaptaciones para ejecutar módulos y el mock de procesos quedaron en `/tmp`. No se cambió el código de la app, no se controló hardware y no se enviaron etiquetas.

El desajuste de Code 128 se comprobó contra el contrato documentado por Zebra; el tamaño real del símbolo en el papel y el comportamiento del spooler requieren comprobación en Windows con la impresora. La firma nativa y el límite de argumentos se contrastaron con Microsoft. No se instaló el entorno Next.js ni se ejecutó un build completo.

Orden revisado: corregir los hallazgos 8 y 9 junto con resolución/ambigüedad de productos, asegurar los escaneos pendientes, arreglar el puente USB y recuperación de configuración, y después mejorar trazabilidad y presentación de estados.


## Contraste con la revisión independiente de Claude Code

El usuario compartió una segunda revisión. Coincide con los problemas de resolución, barcode duplicado, escaneos pendientes, medidas y envío USB. Su límite de siete etiquetas es coherente con la medición anterior: el umbral depende del contenido y longitud de argumentos, por lo que el ejemplo concreto de diez etiquetas sobre el límite evita prometer un umbral universal para cualquier plantilla futura.

### 18. P2 — Codificación distinta entre USB y TCP, sin ^CI explícito

Ubicación: `src/lib/printing/usb.transport.ts:97`, `src/lib/printing/tcp.transport.ts:11` y `src/lib/labels/zpl.builder.ts:85`.

USB convierte el texto a latin1 y TCP envía strings con UTF-8 por defecto. El generador no declara `^CI`. Medido en el catálogo: 105 productos tienen caracteres no ASCII en el nombre; 113 los tienen en alguno de sus campos, incluida la referencia. Son 85 nombres si se cuentan únicamente las vocales españolas con tilde, ñ y ü. No son necesariamente 113 nombres afectados.

Hay un problema comprobado de contrato de codificación; los glifos exactos que salgan mal dependen del estado, fuente y firmware de la impresora, y no se verificaron físicamente. Solución propuesta: UTF-8 coherente en ambos transportes y `^CI28` por etiqueta, comprobando compatibilidad del firmware y de la fuente; probar Ñ, É y demás caracteres realmente presentes.

Fuente: [Zebra: ^CI, UTF-8 y compatibilidad de firmware](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-ci.html).

### 19. P2 — Los nombres largos no tienen una estrategia de ajuste segura

Ubicación: `src/lib/labels/label.template.ts:116`–`:125`.

La variante con barcode usa ancho 240 dots y máximo una línea. Hay 1.049 nombres de más de 30 caracteres (máximo 50). Ese conteo es una señal de exposición, no una medición exacta de cuáles desbordan: la fuente es proporcional y el ancho de cada texto necesita evaluación. La guía de `^FB` indica que el texto que excede las líneas previstas se superpone en la última línea.

Solución: reservar altura para varias líneas, ajustar fuente o aplicar una abreviación explícita sin perder la identificación del producto. No simplemente aumentar `maxLines` sin recalcular las zonas, porque el barcode empieza en y=96. Validar nombres largos en papel, incluida la variante sin barcode.

Fuente: [Zebra: ^FB y exceso de líneas](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-fb.html).

### 20. P2 — La configuración de arranque no restringe la app al puesto local

Ubicación: `package.json` (scripts dev/start) y `.env.example`.

Los scripts llaman `next dev` y `next start` sin `-H`. La documentación oficial indica escucha predeterminada en `0.0.0.0`. `HOST=127.0.0.1` en el ejemplo no se utiliza desde el código ni se pasa como argumento. Las rutas de impresión y configuración no tienen autenticación.

Consecuencia condicionada a la conectividad y firewall: otro equipo que alcance ese puerto puede pedir impresiones o cambiar ajustes. No se comprobó exposición efectiva de un servidor en esta revisión. Para un único puesto, arrancar explícitamente con `-H 127.0.0.1`. Si se necesita acceso compartido, definir autenticación, permisos y protección de las mutaciones, en lugar de ocultar esa necesidad.

Fuente: [Next.js: opciones de hostname de dev/start](https://nextjs.org/docs/app/api-reference/cli/next).

### Matices y mejoras confirmadas del segundo informe

- El estado del helper usa coincidencia aproximada de cola (`scripts/send-raw.ps1:25`) como fallback, mientras `OpenPrinter` abre el nombre solicitado (`:111`). El estado puede pertenecer a otra cola y aparentar que el destino existe. Exigir el mismo identificador exacto para estado y envío.
- El timeout USB de 15 segundos puede llegar después de que el trabajo fue aceptado; matar PowerShell no demuestra que no se imprimirá. Es el mismo problema de reintentos e idempotencia registrado arriba.
- No se encontró un repositorio Git utilizable con `git rev-parse` en el workspace. Antes de reparar, preparar una base con seguimiento y una copia recuperable, excluyendo dependencias, cachés y datos que no deban publicarse. La descarga omitió `.git` si hubiese aparecido como carpeta; no se deduce de aquí el historial del proyecto de origen.
- Las pruebas existentes no están agrupadas en un comando `test`. Conviene ejecutarlas desde fuentes con un comando único y agregar las regresiones descritas; las compilaciones `.preview-build` no deben convertirse en otra fuente de verdad.
- La limpieza de copias antiguas, backups y logs es una mejora de organización; requiere definir cuáles son referencias o datos recuperables antes de eliminarlos. No se borró ninguno.

Los hallazgos 18–20 se contrastaron con código, datos y documentación primaria. Ninguna de las dos revisiones ha confirmado esos síntomas con la impresora física.
