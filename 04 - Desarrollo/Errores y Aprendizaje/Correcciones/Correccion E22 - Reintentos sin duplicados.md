---
tipo: registro-correccion
fichas: [E22]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E22 — un timeout podía causar etiquetas duplicadas

Fecha: 2026-09-29
Ficha: [[E22 - Un timeout puede causar etiquetas duplicadas]]
Commit: `fix(printing): mark uncertain sends and never resend a known request id`

## Comprensión inicial

- **Ocurría:** a los 15 s se mataba PowerShell y se informaba fallo, aunque el spooler pudiera haber aceptado el trabajo. También podía perderse la respuesta HTTP después del envío. Reintentar podía dar dos etiquetas.
- **Por qué:** todo fallo se trataba igual y el servidor no reconocía una solicitud repetida.

## Antes del cambio

- `request.ledger.test.ts` (5 tests): el registro por ID no existía.
- `tcp.transport.test.ts`: una conexión cortada a mitad debía marcarse `uncertain`; una impresora inalcanzable, no. El primero falló.
- `use-print.test.ts`: reutilizar el ID solo tras una respuesta perdida y para el mismo producto, cantidad y modo. Falló: no existía.

## Cambio

- `PrintResult.uncertain`: el trabajo **pudo** llegar (timeout con el envío en curso, conexión cortada después de conectar). Sin la marca, el fallo es seguro. USB: el timeout en envío es incierto (matar PowerShell no retira un trabajo aceptado).
- `createRequestLedger()` en `/api/labels`, por `requestId`: en curso → se comparte; enviado → se responde lo mismo con `duplicate` sin reenviar; incierto → **nunca** se reenvía solo; fallido seguro → se olvida y se puede reintentar. Un duplicado no agrega otra línea al historial.
- Cliente: cada impresión lleva un `requestId`. Si la respuesta no llega, se guarda y volver a imprimir lo mismo lo reutiliza. Mensajes distintos para respuesta perdida, envío incierto y solicitud repetida.

Estados de la ficha: recibido / enviando se ven en la UI como "Enviando…"; aceptado, fallido e incierto quedan en la respuesta y en el historial ([[Correccion M01 - Historial reconstruible]]).

## Después del cambio

Suite (97) y typecheck verdes.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** el registro vive en memoria: un reinicio olvida los IDs (solo importa si la respuesta se pierde justo en un reinicio). No se promete "exactamente una vez": eso requeriría confirmación física. **Pendiente de prueba física:** con la cola en pausa y un timeout forzado, confirmar que la UI dice "puede que se haya impreso" y que volver a pulsar tras perder la respuesta no duplica.
