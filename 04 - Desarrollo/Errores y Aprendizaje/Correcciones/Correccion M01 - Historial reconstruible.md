---
tipo: registro-correccion
fichas: [M01]
fecha: 2026-09-29
estado: corregido
prueba-fisica: no
---
# Corrección de M01 — el historial no permitía reconstruir la etiqueta

Fecha: 2026-09-29
Ficha: [[M01 - El historial no permite reconstruir la etiqueta]]
Commit: `feat(history): record what was sent and the real send status`

## Comprensión inicial

El historial guardaba código, nombre, cantidad y un booleano. Si cambiaba el catálogo, no se podía saber qué precio o qué barcode llevó una etiqueta ya enviada, ni separar un fallo seguro de uno incierto.

## Antes del cambio

El historial se extrajo tal cual a `src/lib/audit/audit.file.ts` (ruta inyectada) y se probó sobre un directorio temporal (`audit.file.test.ts`):
- Un registro debía guardar versión 2, estado, precio, barcode emitido, avisos, medida, `requestId` y `spoolerJobId`: fallaba.
- Un envío incierto debía registrarse como `incierto`: fallaba.
- Las líneas del formato anterior debían leerse con su estado deducido: fallaba.
- Una línea corrupta no debía ocultar el resto: ya funcionaba (guarda).

## Cambio

- `PrintRecord` versión 2: `status` (`enviado` / `fallido` / `incierto`), `price`, `barcode` (`{symbology, data}` o `null` si salió sin código), `avisos`, `label` (medida), `requestId`. Tres identificadores separados: `jobId` (auditoría), `requestId` (solicitud, E22), `spoolerJobId` (cola de Windows, E10).
- `ok` se mantiene como `status === "enviado"`, para no romper lecturas anteriores. Las líneas versión 1 se leen con `status` deducido de `ok`.
- `/api/labels` registra la foto de lo que envió.
- La pantalla de historial muestra estado (Enviado / Fallido / Incierto: revisar la impresora), precio y código emitido. Dice "Enviado", no "OK" ([[Correccion E07 - Enviado no es impreso]]).

No se migró a base de datos ni se agregó rotación: con decenas de impresiones por día no hace falta todavía.

## Después del cambio

4/4 tests; suite (101) y typecheck verdes.

## Cierre

- [x] Caso original corregido. - [x] Líneas viejas siguen legibles. - [x] Causa explicada. - [x] Evidencia reproducible.
