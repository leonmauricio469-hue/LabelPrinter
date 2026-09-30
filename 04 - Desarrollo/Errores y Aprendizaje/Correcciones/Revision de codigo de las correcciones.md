---
tipo: registro-revision
fecha: 2026-09-29
estado: corregido
prueba-fisica: ver Plan de prueba fisica
---
# Revisión de código de las correcciones

Fecha: 2026-09-29
Alcance: todo el diff de la rama `fix/revision-2026-09-29` sobre la base `75ee9a8` (66 archivos de `label-printer-web`, unas 2.900 líneas agregadas).
Commit: `fix: address code review of the review fixes`

Antes de subir, el diff pasó por cuatro revisores independientes, cada uno con un foco: **riesgo** (seguridad y exposición de datos), **confiabilidad** (comportamiento, casos borde, tests), **resiliencia** (procesos externos, fallos parciales, reintentos) y **legibilidad**. Cada hallazgo se corrigió con un test que primero fallaba, salvo donde se indica.

## Hallazgos y resolución

| id | severidad | hallazgo | resolución |
|---|---|---|---|
| R3-001 | CRITICAL | En la pantalla, imprimir con éxito el producto B borraba la solicitud perdida de A; reimprimir A usaba un ID nuevo y podía duplicar la etiqueta, contradiciendo el mensaje mostrado. | Una entrada por `producto|cantidad|modo` (`rememberLost` / `forgetLost`). Test: tras el éxito de B, A conserva su ID. |
| R4-001 | CRITICAL | Si `WritePrinter` fallaba, `AbortPrinter` se llamaba sin comprobarlo. Si también fallaba, el trabajo podía quedar en la cola e imprimirse, pero se informaba como fallo seguro y se permitía reintentar. | `send-raw.ps1` comprueba el abort y marca `uncertain` si falla; `spoolerResult` propaga `uncertain`. Test de contrato y de Node. |
| R4-002 | WARNING | `EndDocPrinter` fallando con todo enviado se informaba como fallo seguro. | Se marca `uncertain`: la etiqueta pudo salir. |
| R1-001 | WARNING | El registro por ID no estaba atado a lo que imprime: reutilizar un ID para otro producto devolvía "ya enviada" sin enviar nada. | La clave incluye `producto|cantidad|modo`. Test. |
| R1-002 | WARNING | CSRF: cualquier página abierta en el navegador del puesto podía enviar un formulario a `127.0.0.1:3000/api/labels` (hasta 999 etiquetas) o cambiar la impresora. | `crossSiteRejection()`: cuerpo `application/json` obligatorio y `Origin` igual al host, en `POST /api/labels`, `PUT /api/settings` y `POST /api/printer/test`. Tests y comprobado contra el servidor compilado: 403/415 desde otra web, la app sigue funcionando. |
| R4-003 | WARNING | Un guardado de configuración fallido dejaba archivos `.tmp` huérfanos. | Se borran en el error. Test forzando el fallo de la copia de respaldo. |
| R4-004 | WARNING | `PUT /api/settings` no capturaba un error de escritura: el operador veía "Unexpected token…". | Error en JSON con el motivo (sin test propio: la ruta no tiene harness; ver R3-003). |
| R3-002 | WARNING | No se comprobaba que nombre, barcode y referencia no se solaparan en las medidas extremas que acepta la configuración. | Test sobre todas las medidas de 30–104 × 20–100 mm cada 2 mm: **pasó sin cambios**, era un hueco de cobertura, no un defecto. Queda como guarda. |
| R3-003 | SUGGESTION | La ruta `/api/labels` no tiene test propio; se prueban sus piezas. | **No se hizo**: exige montar Next.js en los tests. Cubierto por tests de cada pieza y por la prueba de humo contra el servidor compilado. |
| R2-001 | WARNING | Una constante entre los `import` de la ruta. | Movida debajo de los imports. |
| R2-002 | SUGGESTION | `fieldData` nombraba dos cosas distintas. | La función local pasó a `fieldCommand()`. |
| R2-003 | SUGGESTION | Ternario anidado para los umbrales de Code C. | `if` / `else` con cada caso comentado. |

Los revisores también confirmaron como correctos (sin cambios): el escape de ZPL y de los `>` de Code 128, la invocación de PowerShell sin shell y con el lote por stdin, la lectura y escritura de la configuración, la lógica de éxito e incierto del transporte TCP, la caché de estado y el registro de solicitudes.

## Verificación

`npm run check` (typecheck, 114 tests, `check-busqueda` 26/26, `check-barcode-plan` 32/32), `npm run build` y prueba de humo contra el servidor de producción en `127.0.0.1`. Después, una re-revisión acotada de las líneas del arreglo (resultado abajo).

## Re-revisión acotada

Un revisor independiente verificó solo las líneas del arreglo contra este ledger: **los 12 hallazgos resueltos, ninguno abierto y ningún problema nuevo bloqueante o crítico**. Revisó en particular la sintaxis PowerShell nueva (`${jobId}:`, el `Emit` con `uncertain = $false`), el caso de una solicitud sin encabezado `Host` y que la marca `uncertain` llegue hasta la respuesta y el historial.
