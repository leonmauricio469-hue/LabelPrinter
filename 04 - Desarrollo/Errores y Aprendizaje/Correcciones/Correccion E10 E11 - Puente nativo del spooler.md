---
tipo: registro-correccion
fichas: [E10, E11, E21]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E10, E11 y E21 — puente nativo del spooler

Fecha: 2026-09-29
Fichas: [[E10 - La firma nativa de StartDocPrinter es incorrecta]], [[E11 - El helper no comprueba todos los bytes escritos]], [[E21 - Estado y envio pueden usar colas diferentes]]
Commit: `fix(usb): match the Win32 spooler contract and report the real job id`

## Comprensión inicial

- **E10:** `StartDocPrinter` estaba declarado como `bool` con un cuarto parámetro `out jobId` que nada nativo rellena. La API real recibe 3 parámetros y devuelve el ID del trabajo (0 = error). El `jobId` del historial era un UUID de auditoría, no el de la cola.
- **E11:** se comprobaba el booleano de `WritePrinter`, pero no que `$written` fuera igual a los bytes enviados.
- **E21:** el estado (`Status`) caía a una coincidencia por subcadena (`-like "*nombre*"`) mientras el envío abre el nombre exacto: el estado podía ser de otra cola.

## Antes del cambio

`send-raw.ps1` solo corre en Windows, así que se escribió un **test de contrato** (`src/lib/printing/send-raw.contract.test.ts`) que compara el texto del script con los contratos documentados de Microsoft: firma de 3 parámetros, `jobId = 0` como error, bucle hasta escribir todos los bytes con `AbortPrinter` si no avanza, sin `-like`, y `jobId` en la respuesta. Fallaron los 5.

Del lado Node, `spoolerResult()` (nuevo, puro) debía propagar `jobId` y rechazar un trabajo con menos bytes que los enviados: 4 tests en `spooler.invocation.test.ts`, en RED.

## Cambio

- `StartDocPrinter` → `int StartDocPrinter(IntPtr, int, ref DOCINFOW)`; `0` es error.
- Escritura en bucle hasta completar; si `WritePrinter` falla o no avanza, `AbortPrinter` y error con cuántos bytes llegaron.
- `Status` y `Send` usan solo el nombre exacto de la cola.
- La respuesta incluye `jobId`; `PrintResult.spoolerJobId` lo lleva a `/api/labels` y al historial (`spoolerJobId`, separado del `jobId` de auditoría).
- Node verifica además que `bytes` informado == bytes enviados (defensa en profundidad).

## Después del cambio

Los 9 tests pasan; suite completa y typecheck verdes. El script sigue siendo ASCII puro (PowerShell 5.1 lo lee como ANSI).

## Cierre

- [x] Caso original corregido (por contrato). - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** un test de contrato no ejecuta el script. **Pendiente de prueba física:** imprimir por USB en Windows y comprobar que el historial guarda un `spoolerJobId` igual al que muestra la cola de Windows; probar un nombre de cola parecido pero distinto y confirmar que el estado no lo toma.
