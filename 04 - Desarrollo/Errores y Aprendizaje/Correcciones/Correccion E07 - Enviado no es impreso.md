---
tipo: registro-correccion
fichas: [E07]
fecha: 2026-09-29
estado: corregido
prueba-fisica: pendiente
---
# Corrección de E07 — enviado no significa impreso

Fecha: 2026-09-29
Ficha: [[E07 - Enviado no significa impreso]]
Commit: `fix(printing): report delivery, not printing, and wait for TCP delivery`

## Comprensión inicial

- **Ocurría:** TCP resolvía `ok` en el evento `connect`, antes de escribir un byte. La UI decía "N etiquetas impresas" aunque solo supiera que el trabajo fue aceptado.
- **Por qué:** se mezclaban tres hechos distintos: aceptar la solicitud, entregar los bytes y producir la etiqueta física.

## Antes del cambio

`src/lib/printing/tcp.transport.test.ts` con un servidor TCP local real:
- La impresora simulada debía haber recibido todo y cerrado su lado antes del `ok`: falló ("resolved before the stream was finished").
- La impresora corta la conexión después del primer bloque de un lote de 20 MB: se esperaba fallo y se obtuvo `ok`.

Ambos fallaron de forma estable en 3 ejecuciones.

## Cambio

- `sendZpl` responde con el `close` del socket sin error, después de escribir todo. Si la impresora deja la conexión abierta, el timeout de inactividad la cierra: con todo escrito cuenta como entregado; a mitad, como fallo con mensaje claro.
- `sentMessage()` en `use-print.ts`: "N etiquetas enviadas a la impresora". Test en `use-print.test.ts`.

Alternativa considerada: responder en el callback de `end()` (bytes en el buffer del sistema). Se descartó: no confirma que la impresora los recibió.

## Después del cambio

Los 3 tests pasan de forma estable; suite completa verde.

## Cierre

- [x] Caso original corregido. - [x] Relacionados funcionan. - [x] Causa explicada. - [x] Evidencia reproducible.

**Pendientes y límites:** "entregado" sigue sin ser "impreso": falta de papel, cinta o una pausa no se detectan por TCP. El ID real del trabajo en la cola de Windows se resuelve en [[Correccion E10 E11 - Puente nativo del spooler]]. **Pendiente de prueba física:** enviar con la cola en pausa y comprobar que la UI no promete papel.
